import { useEffect, useMemo, useState } from "react";
import { db } from "./db";
import type { Card, Deck, DeckCard } from "./db";
function Thumb({ blob, alt }: { blob?: Blob; alt: string }) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  if (!url) return null;

  return (
    <img
      src={url}
      alt={alt}
      style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }}
    />
  );
}

const TARGET_DECK_SIZE = 40;
const SAME_NAME_LIMIT = 3;

function sumCounts(items: DeckCard[]) {
  return items.reduce((acc, x) => acc + x.count, 0);
}

export default function App() {
  const [activeDeckId, setActiveDeckId] = useState<number | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [deckCards, setDeckCards] = useState<DeckCard[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Partial<Card>>({ name: "", number: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);

  // 初回：デッキが無ければ作る
  useEffect(() => {
    const run = async () => {
      const deckCount = await db.decks.count();
      if (deckCount === 0) {
        const id = await db.decks.add({ name: "デッキ1", createdAt: Date.now() });
        setActiveDeckId(id);
      }

      const allDecks = await db.decks.toArray();
      setDecks(allDecks);

      // activeDeckが未設定なら先頭を選ぶ
      const firstId = allDecks[0]?.id ?? null;
      setActiveDeckId((prev) => prev ?? firstId);
    };
    run();
  }, []);

  // データ読み込み（activeDeckId が変わったら読み直す）
  useEffect(() => {
    const refresh = async () => {
      const allDecks = await db.decks.toArray();
      setDecks(allDecks);

      const allCards = await db.cards.orderBy("updatedAt").reverse().toArray();
      setCards(allCards);

      if (activeDeckId != null) {
        const dcs = await db.deckCards.where("deckId").equals(activeDeckId).toArray();
        setDeckCards(dcs);
      } else {
        setDeckCards([]);
      }
    };

    function Thumb({ blob, alt }: { blob?: Blob; alt: string }) {
      const [url, setUrl] = useState<string>("");

      useEffect(() => {
        if (!blob) {
          setUrl("");
          return;
        }
        const u = URL.createObjectURL(blob);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
      }, [blob]);

      if (!url) return null;

      return (
        <img
          src={url}
          alt={alt}
          style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }}
        />
      );
    }


    refresh();
  }, [activeDeckId]);

  const totalInDeck = useMemo(() => sumCounts(deckCards), [deckCards]);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const num = (c.number ?? "").toLowerCase();
      return name.includes(q) || num.includes(q);
    });
  }, [cards, search]);

  const deckCardMap = useMemo(() => {
    const m = new Map<number, DeckCard>();
    for (const dc of deckCards) m.set(dc.cardId, dc);
    return m;
  }, [deckCards]);

  async function refreshAll() {
    const allDecks = await db.decks.toArray();
    setDecks(allDecks);

    const allCards = await db.cards.orderBy("updatedAt").reverse().toArray();
    setCards(allCards);

    if (activeDeckId != null) {
      const dcs = await db.deckCards.where("deckId").equals(activeDeckId).toArray();
      setDeckCards(dcs);
    } else {
      setDeckCards([]);
    }
  }

  async function addCardToDeck(cardId: number) {
    if (activeDeckId == null) return;

    if (totalInDeck >= TARGET_DECK_SIZE) {
      alert("デッキが40枚に達しています。減らしてから追加してください。");
      return;
    }

    const existing = deckCardMap.get(cardId);
    const nextCount = (existing?.count ?? 0) + 1;

    if (nextCount > SAME_NAME_LIMIT) {
      alert("同名カードは最大3枚までです。");
      return;
    }

    const found = await db.deckCards
      .where("[deckId+cardId]")
      .equals([activeDeckId, cardId])
      .first();

    if (found?.id) {
      await db.deckCards.update(found.id, { count: nextCount });
    } else {
      await db.deckCards.add({ deckId: activeDeckId, cardId, count: 1 });
    }

    await refreshAll();
  }

async function deleteCard(cardId: number) {
  const ok = confirm("このカードを削除しますか？（デッキからも消えます）");
  if (!ok) return;

  // デッキ内の参照も削除
  await db.deckCards.where("cardId").equals(cardId).delete();

  // カード本体を削除
  await db.cards.delete(cardId);

  await refreshAll();
}


  async function decCardInDeck(cardId: number) {
    if (activeDeckId == null) return;

    const found = await db.deckCards
      .where("[deckId+cardId]")
      .equals([activeDeckId, cardId])
      .first();

    if (!found?.id) return;

    const next = found.count - 1;
    if (next <= 0) await db.deckCards.delete(found.id);
    else await db.deckCards.update(found.id, { count: next });

    await refreshAll();
  }

  async function saveCard() {
    const name = (form.name ?? "").trim();
    const number = (form.number ?? "").trim();
    if (!name) {
      alert("カード名は必須です。");
      return;
    }

    const imageBlob =
      imageFile ? new Blob([await imageFile.arrayBuffer()], { type: imageFile.type }) : undefined;

    await db.cards.add({
      name,
      number: number || undefined,
      color: (form.color ?? "").trim() || undefined,
      type: (form.type ?? "").trim() || undefined,
      memo: (form.memo ?? "").trim() || undefined,
      image: imageBlob,
      updatedAt: Date.now(),
    });

    setForm({ name: "", number: "", color: "", type: "", memo: "" });
    await refreshAll();
  }

  async function createDeck() {
    const name = prompt("デッキ名")?.trim();
    if (!name) return;

    const id = await db.decks.add({ name, createdAt: Date.now() });
    setActiveDeckId(id);
  }

  async function renameDeck(deckId: number) {
    const deck = decks.find((d) => d.id === deckId);
    const current = deck?.name ?? "";

    const name = prompt("新しいデッキ名", current)?.trim();
    if (!name) return;

    await db.decks.update(deckId, { name });
    await refreshAll();
  }


  async function deleteDeck(deckId: number) {
    // いま選択中のデッキを消す場合もあるので、名前を表示して確認
    const deck = decks.find((d) => d.id === deckId);
    const name = deck?.name ?? "このデッキ";

    const ok = confirm(`${name} を削除しますか？（中のカード一覧も消えます）`);
    if (!ok) return;

    // そのデッキに入っているカード参照を全部削除
    await db.deckCards.where("deckId").equals(deckId).delete();

    // デッキ本体を削除
    await db.decks.delete(deckId);

    // もし削除したのがアクティブだったら、別のデッキに切り替える
    if (activeDeckId === deckId) {
      const remain = decks.filter((d) => d.id !== deckId);
      setActiveDeckId(remain[0]?.id ?? null);
    }

    await refreshAll();
  } 


  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ margin: "8px 0 16px" }}>Conan Card Deck（オフライン）</h1>

      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        {/* 左：カード登録＆検索 */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>カード登録</h2>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              placeholder="カード名（必須）"
              value={form.name ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              placeholder="カード番号（任意）"
              value={form.number ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                placeholder="色（任意）"
                value={form.color ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              />
              <input
                placeholder="種類（任意）"
                value={form.type ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              />
            </div>
            <textarea
              placeholder="メモ（任意）"
              value={form.memo ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
              rows={3}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setImageFile(file);
            }}
            />

            <button onClick={saveCard}>保存</button>
          </div>

          <hr style={{ margin: "16px 0" }} />

          <h2 style={{ marginTop: 0 }}>カード検索</h2>
          <input
            placeholder="名前 or 番号で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%" }}
          />

          <div
            style={{
              marginTop: 12,
              maxHeight: 420,
              overflow: "auto",
              border: "1px solid #eee",
              borderRadius: 8,
            }}
          >
            {filteredCards.length === 0 ? (
              <div style={{ padding: 12, color: "#666" }}>
                まだカードがありません。上で登録してください。
              </div>
            ) : (
              filteredCards.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    alignItems: "center",
                    padding: 10,
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                 <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                   <Thumb blob={c.image} alt={c.name ?? "card"} />

                   <div>
                     <div style={{ fontWeight: 700 }}>{c.name}</div>
                     <div style={{ fontSize: 12, color: "#666" }}>
                       {c.number ? `#${c.number}` : ""}
                       {c.color ? ` / ${c.color}` : ""}
                       {c.type ? ` / ${c.type}` : ""}
                     </div>
                   </div>
                 </div>

                 <div style={{ display: "flex", gap: 6 }}>
                   <button onClick={() => addCardToDeck(c.id!)}>＋</button>
                   <button onClick={() => deleteCard(c.id!)}>🗑</button>
                 </div>
               </div>
             ))
           )}
         </div>



        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0 }}>デッキ</h2>
            <button onClick={createDeck}>デッキ追加</button>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
           {decks.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => setActiveDeckId(d.id!)}
              onDoubleClick={() => renameDeck(d.id!)}
              style={{
                borderRadius: 999,
                padding: "6px 10px",
                border: "1px solid #ccc",
                background: d.id === activeDeckId ? "#eee" : "white",
                cursor: "pointer",
              }}
              title="ダブルクリックでリネーム"
            >
              {d.name}
            </button>

    <button
      onClick={() => deleteDeck(d.id!)}
      title="デッキ削除"
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        border: "1px solid #ddd",
        background: "white",
        cursor: "pointer",
      }}
    >
      🗑
    </button>
  </div>
))}

          </div>

          <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: "1px solid #eee" }}>
            <div style={{ fontWeight: 700 }}>合計：{totalInDeck} / {TARGET_DECK_SIZE}</div>
            {totalInDeck === TARGET_DECK_SIZE ? (
              <div style={{ color: "green", marginTop: 4 }}>✅ 40枚完成</div>
            ) : (
              <div style={{ color: "#666", marginTop: 4 }}>左の検索結果の「＋」で追加できます</div>
            )}
          </div>

                    <div style={{ marginTop: 12, maxHeight: 520, overflow: "auto", border: "1px solid #eee", borderRadius: 8 }}>
            {deckCards.length === 0 ? (
              <div style={{ padding: 12, color: "#666" }}>まだデッキにカードがありません。</div>
            ) : (
              deckCards.map((dc) => {
                const c = cards.find((x) => x.id === dc.cardId);

                return (
                  <div
                    key={dc.cardId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: 10,
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <Thumb blob={c?.image} alt={c?.name ?? "card"} />

                      <div>
                        <div style={{ fontWeight: 700 }}>{c?.name ?? "（不明カード）"}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          {c?.number ? `#${c.number}` : ""}
                          {c?.color ? ` / ${c.color}` : ""}
                          {c?.type ? ` / ${c.type}` : ""}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => decCardInDeck(dc.cardId)}>-</button>
                      <div style={{ minWidth: 24, textAlign: "center", fontWeight: 700 }}>{dc.count}</div>
                      <button onClick={() => addCardToDeck(dc.cardId)}>+</button>
                    </div>
                  </div>
              );
            })
          )}
        </div>
      </div> {/* ← 右パネル閉じ */}
      </div>
    </section>
   </div>
 );
}
