import { useEffect, useMemo, useState } from "react";
import { db, fullSync, syncFromSupabase, syncToSupabase } from "./db";
import type { Card, Deck, DeckCard } from "./db";
import "./App.css";

// 画像サムネイルコンポーネント
function Thumb({ blob, alt, size = "small" }: { blob?: Blob; alt: string; size?: "small" | "large" }) {
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

  if (!url) {
    return (
      <div className={size === "large" ? "card-image-container" : "deck-card-thumb"}>
        <div className="card-placeholder">🃏</div>
      </div>
    );
  }

  if (size === "large") {
    return (
      <div className="card-image-container">
        <img src={url} alt={alt} />
      </div>
    );
  }

  return (
    <div className="deck-card-thumb">
      <img src={url} alt={alt} />
    </div>
  );
}

// 色のマッピング
const colorMap: Record<string, string> = {
  赤: "#e53935",
  青: "#1e88e5",
  黄: "#fdd835",
  緑: "#43a047",
  無色: "#9e9e9e",
};

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
  const [form, setForm] = useState<Partial<Card>>({ 
    name: "", 
    number: "", 
    color: "赤",
    type: "キャラクター"
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"cards" | "decks" | "editor" | "sync">("cards");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // 初回：デッキが無ければ作る
  useEffect(() => {
    const run = async () => {
      const deckCount = await db.decks.count();
      if (deckCount === 0) {
        const id = await db.decks.add({ 
          name: "デッキ1", 
          createdAt: Date.now(),
          synced: false 
        });
        setActiveDeckId(id);
      }

      const allDecks = await db.decks.toArray();
      setDecks(allDecks);

      const firstId = allDecks[0]?.id ?? null;
      setActiveDeckId((prev) => prev ?? firstId);
    };
    run();
  }, []);

  // データ読み込み
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
      await db.deckCards.update(found.id, { count: nextCount, synced: false });
    } else {
      await db.deckCards.add({ 
        deckId: activeDeckId, 
        cardId, 
        count: 1,
        synced: false 
      });
    }

    await refreshAll();
  }

  async function deleteCard(cardId: number) {
    const ok = confirm("このカードを削除しますか？（デッキからも消えます）");
    if (!ok) return;

    await db.deckCards.where("cardId").equals(cardId).delete();
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
    else await db.deckCards.update(found.id, { count: next, synced: false });

    await refreshAll();
  }

  async function saveCard() {
    const name = (form.name ?? "").trim();
    const number = (form.number ?? "").trim();
    if (!name) {
      alert("カード名は必須です。");
      return;
    }

    const imageBlob = imageFile
      ? new Blob([await imageFile.arrayBuffer()], { type: imageFile.type })
      : undefined;

    await db.cards.add({
      name,
      number: number || undefined,
      color: (form.color ?? "").trim() || undefined,
      type: (form.type ?? "").trim() || undefined,
      memo: (form.memo ?? "").trim() || undefined,
      image: imageBlob,
      updatedAt: Date.now(),
      synced: false,
    });

    setForm({ name: "", number: "", color: "赤", type: "キャラクター", memo: "" });
    setImageFile(null);
    await refreshAll();
  }

  async function createDeck() {
    const name = prompt("デッキ名")?.trim();
    if (!name) return;

    const id = await db.decks.add({ 
      name, 
      createdAt: Date.now(),
      synced: false 
    });
    setActiveDeckId(id);
  }

  async function renameDeck(deckId: number) {
    const deck = decks.find((d) => d.id === deckId);
    const current = deck?.name ?? "";

    const name = prompt("新しいデッキ名", current)?.trim();
    if (!name) return;

    await db.decks.update(deckId, { name, synced: false });
    await refreshAll();
  }

  async function deleteDeck(deckId: number) {
    const deck = decks.find((d) => d.id === deckId);
    const name = deck?.name ?? "このデッキ";

    const ok = confirm(`${name} を削除しますか？（中のカード一覧も消えます）`);
    if (!ok) return;

    await db.deckCards.where("deckId").equals(deckId).delete();
    await db.decks.delete(deckId);

    if (activeDeckId === deckId) {
      const remain = decks.filter((d) => d.id !== deckId);
      setActiveDeckId(remain[0]?.id ?? null);
    }

    await refreshAll();
  }

  // 同期機能
  async function handleFullSync() {
    setSyncing(true);
    setSyncMessage("🔄 同期中...");
    
    const result = await fullSync();
    
    if (result.success) {
      setSyncMessage("✅ 同期完了！");
      await refreshAll();
    } else {
      setSyncMessage("❌ 同期エラー");
    }
    
    setSyncing(false);
    setTimeout(() => setSyncMessage(""), 3000);
  }

  async function handleDownloadSync() {
    setSyncing(true);
    setSyncMessage("⬇️ ダウンロード中...");
    
    const result = await syncFromSupabase();
    
    if (result.success) {
      setSyncMessage("✅ ダウンロード完了！");
      await refreshAll();
    } else {
      setSyncMessage("❌ ダウンロードエラー");
    }
    
    setSyncing(false);
    setTimeout(() => setSyncMessage(""), 3000);
  }

  async function handleUploadSync() {
    setSyncing(true);
    setSyncMessage("⬆️ アップロード中...");
    
    const result = await syncToSupabase();
    
    if (result.success) {
      setSyncMessage("✅ アップロード完了！");
      await refreshAll();
    } else {
      setSyncMessage("❌ アップロードエラー");
    }
    
    setSyncing(false);
    setTimeout(() => setSyncMessage(""), 3000);
  }

  const activeDeck = decks.find((d) => d.id === activeDeckId);

  return (
    <div className="app-container">
      {/* ヘッダー */}
      <header className="app-header">
        <div className="app-logo">🃏 Conan Card Deck</div>
        <button className="menu-toggle">☰</button>
      </header>

      {/* ナビゲーション */}
      <nav className="app-nav">
        <ul className="nav-tabs">
          <li>
            <button
              className={`nav-tab-button ${activeTab === "cards" ? "active" : ""}`}
              onClick={() => setActiveTab("cards")}
            >
              カード管理
            </button>
          </li>
          <li>
            <button
              className={`nav-tab-button ${activeTab === "decks" ? "active" : ""}`}
              onClick={() => setActiveTab("decks")}
            >
              デッキ一覧
            </button>
          </li>
          <li>
            <button
              className={`nav-tab-button ${activeTab === "editor" ? "active" : ""}`}
              onClick={() => setActiveTab("editor")}
            >
              デッキ編集
            </button>
          </li>
          <li>
            <button
              className={`nav-tab-button ${activeTab === "sync" ? "active" : ""}`}
              onClick={() => setActiveTab("sync")}
            >
              ☁️ 同期
            </button>
          </li>
        </ul>
      </nav>

      {/* メインコンテンツ */}
      <div className="app-content">
        {/* カード管理画面 */}
        <div className={`screen ${activeTab === "cards" ? "active" : ""}`}>
          {/* カード登録 */}
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">新しいカードを登録</h2>
            </div>
            <div className="form-grid">
              <input
                type="text"
                placeholder="カード名（必須）"
                value={form.name ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
              <div className="form-row">
                <input
                  type="text"
                  placeholder="カード番号（任意）"
                  value={form.number ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))}
                />
                <select
                  value={form.color ?? "赤"}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                >
                  <option>赤</option>
                  <option>青</option>
                  <option>黄</option>
                  <option>緑</option>
                  <option>無色</option>
                </select>
              </div>
              <select
                value={form.type ?? "キャラクター"}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option>キャラクター</option>
                <option>イベント</option>
                <option>アイテム</option>
              </select>
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
              <button className="btn-primary" onClick={saveCard}>
                ✅ カードを保存
              </button>
            </div>
          </div>

          {/* カード検索 */}
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">カード一覧</h2>
            </div>
            <div className="search-bar">
              <input
                type="text"
                placeholder="🔍 カード名・番号で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {filteredCards.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🃏</div>
                <div>まだカードがありません</div>
                <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                  上のフォームから登録してください
                </div>
              </div>
            ) : (
              <div className="cards-grid">
                {filteredCards.map((c) => (
                  <div key={c.id} className="card-item">
                    {c.color && (
                      <div
                        className="card-color-badge"
                        style={{ background: colorMap[c.color] || "#9e9e9e" }}
                      />
                    )}
                    <Thumb blob={c.image} alt={c.name ?? "card"} size="large" />
                    <div className="card-name">{c.name}</div>
                    <div className="card-number">
                      {c.number ? `No.${c.number}` : ""}
                      {c.type ? ` • ${c.type}` : ""}
                    </div>
                    <div className="card-actions">
                      <button
                        className="btn-primary"
                        style={{ flex: 1, padding: "0.5rem" }}
                        onClick={() => addCardToDeck(c.id!)}
                      >
                        ➕ デッキへ
                      </button>
                      <button
                        className="btn-danger btn-icon"
                        onClick={() => deleteCard(c.id!)}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* デッキ一覧画面 */}
        <div className={`screen ${activeTab === "decks" ? "active" : ""}`}>
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">デッキ管理</h2>
              <button className="btn-primary" onClick={createDeck}>
                ➕ 新規デッキ作成
              </button>
            </div>
            <div className="deck-list">
              {decks.map((d) => (
                <div
                  key={d.id}
                  className={`deck-chip ${d.id === activeDeckId ? "active" : ""}`}
                  onClick={() => {
                    setActiveDeckId(d.id!);
                    setActiveTab("editor");
                  }}
                  onDoubleClick={() => renameDeck(d.id!)}
                  title="クリックで選択・ダブルクリックでリネーム"
                >
                  <span>{d.name}</span>
                  <button
                    className="deck-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDeck(d.id!);
                    }}
                    title="削除"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* デッキ編集画面 */}
        <div className={`screen ${activeTab === "editor" ? "active" : ""}`}>
          {activeDeck ? (
            <>
              {/* デッキ統計 */}
              <div className="deck-stats">
                <div className="deck-stats-title">{activeDeck.name}</div>
                <div className="deck-stats-info">
                  <div>
                    📊 合計: <strong>{totalInDeck} / {TARGET_DECK_SIZE}枚</strong>
                  </div>
                  <div>
                    🎴 種類: <strong>{deckCards.length}種類</strong>
                  </div>
                </div>
              </div>

              {totalInDeck === TARGET_DECK_SIZE && (
                <div className="success-panel info-panel">
                  <div className="info-panel-title">✅ デッキ完成！</div>
                  <div className="info-panel-text">
                    40枚のデッキが完成しました。対戦の準備ができています！
                  </div>
                </div>
              )}

              {/* デッキ内カード */}
              <div className="section">
                <div className="section-header">
                  <h2 className="section-title">デッキ内カード</h2>
                </div>
                {deckCards.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <div>デッキにカードがありません</div>
                    <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                      「カード管理」タブからカードを追加してください
                    </div>
                  </div>
                ) : (
                  <div className="deck-card-list">
                    {deckCards.map((dc) => {
                      const c = cards.find((x) => x.id === dc.cardId);
                      return (
                        <div key={dc.cardId} className="deck-card-row">
                          <Thumb blob={c?.image} alt={c?.name ?? "card"} size="small" />
                          <div className="deck-card-info">
                            <div className="deck-card-info-name">
                              {c?.name ?? "（不明カード）"}
                            </div>
                            <div className="deck-card-info-meta">
                              {c?.number ? `No.${c.number}` : ""}
                              {c?.color ? ` • ${c.color}` : ""}
                              {c?.type ? ` • ${c.type}` : ""}
                            </div>
                          </div>
                          <div className="deck-card-controls">
                            <button className="count-btn" onClick={() => decCardInDeck(dc.cardId)}>
                              −
                            </button>
                            <div className="card-count">{dc.count}</div>
                            <button className="count-btn" onClick={() => addCardToDeck(dc.cardId)}>
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🎴</div>
              <div>デッキを選択してください</div>
              <div style={{ marginTop: "1rem" }}>
                <button className="btn-primary" onClick={createDeck}>
                  ➕ 新しいデッキを作成
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 同期画面 */}
        <div className={`screen ${activeTab === "sync" ? "active" : ""}`}>
          <div className="info-panel">
            <div className="info-panel-title">☁️ クラウド同期</div>
            <div className="info-panel-text">
              Supabaseを使って、PC・スマホ間でデータを同期できます。
              <br />
              同期すると、他のデバイスでも同じデータが使えるようになります。
            </div>
          </div>

          {syncMessage && (
            <div className="info-panel" style={{ 
              background: syncMessage.includes("✅") 
                ? "linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%)" 
                : syncMessage.includes("❌")
                ? "linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)"
                : "linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)"
            }}>
              <div className="info-panel-text" style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
                {syncMessage}
              </div>
            </div>
          )}

          <div className="section">
            <div className="section-header">
              <h2 className="section-title">同期操作</h2>
            </div>
            <div className="form-grid">
              <button 
                className="btn-primary" 
                onClick={handleFullSync}
                disabled={syncing}
                style={{ fontSize: "1.1rem", padding: "1rem" }}
              >
                🔄 完全同期（おすすめ）
              </button>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr", 
                gap: "1rem" 
              }}>
                <button 
                  className="btn-secondary" 
                  onClick={handleDownloadSync}
                  disabled={syncing}
                >
                  ⬇️ クラウドから取得
                </button>
                <button 
                  className="btn-secondary" 
                  onClick={handleUploadSync}
                  disabled={syncing}
                >
                  ⬆️ クラウドへ保存
                </button>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2 className="section-title">📱 使い方</h2>
            </div>
            <div style={{ lineHeight: "1.8" }}>
              <p><strong>1. PCで登録したら：</strong></p>
              <p style={{ marginLeft: "1rem" }}>
                「⬆️ クラウドへ保存」または「🔄 完全同期」をクリック
              </p>
              
              <p style={{ marginTop: "1rem" }}><strong>2. スマホで使うとき：</strong></p>
              <p style={{ marginLeft: "1rem" }}>
                同じURL（https://...）をスマホで開く<br />
                「⬇️ クラウドから取得」または「🔄 完全同期」をクリック
              </p>

              <p style={{ marginTop: "1rem" }}><strong>3. 定期的に：</strong></p>
              <p style={{ marginLeft: "1rem" }}>
                「🔄 完全同期」で最新状態を保つ
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
