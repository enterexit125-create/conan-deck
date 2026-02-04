import { useEffect, useMemo, useState } from "react";
import { db, fullSync, syncFromSupabase, syncToSupabase } from "./db";
import type { Card, Deck, DeckCard } from "./db";
import "./App.css";

// デバッグツール（スマホ用）- 開発時のみ
if (window.location.hostname !== 'localhost') {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  document.body.appendChild(script);
  script.onload = () => {
    // @ts-ignore
    window.eruda?.init();
  };
}

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
  黄: "#fdd835",
  赤: "#e53935",
  青: "#1e88e5",
  緑: "#43a047",
  白: "#f5f5f5",
  黒: "#424242",
};

// 選択肢
const COLOR_OPTIONS = ["黄", "赤", "青", "緑", "白", "黒"];
const TYPE_OPTIONS = ["キャラ", "事件", "イベント", "パートナー"];
const LEVEL_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

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
  
  // 検索・フィルター
  const [search, setSearch] = useState("");
  const [filterColor, setFilterColor] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterLevel, setFilterLevel] = useState<string>("");
  
  const [form, setForm] = useState<Partial<Card>>({ 
    name: "", 
    number: "",  // 空文字列から開始（必須）
    color: "黄",
    type: "キャラ",
    level: "1",
    memo: ""
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"cards" | "decks" | "editor" | "sync">("cards");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  
  // 編集用の状態
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editForm, setEditForm] = useState<Partial<Card>>({});
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  
  // デッキカード編集用
  const [editingDeckCard, setEditingDeckCard] = useState<{ cardId: number; count: number } | null>(null);

  // カード選択モーダル用
  const [showCardSelectModal, setShowCardSelectModal] = useState(false);
  const [cardSelectFilter, setCardSelectFilter] = useState<"all" | "partner" | "incident">("all");
  const [cardSelectSearch, setCardSelectSearch] = useState("");
  const [cardSelectColor, setCardSelectColor] = useState("");
  const [cardSelectType, setCardSelectType] = useState("");
  const [cardSelectLevel, setCardSelectLevel] = useState("");

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
    return cards.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const num = (c.number ?? "").toLowerCase();
      const matchText = !q || name.includes(q) || num.includes(q);
      const matchColor = !filterColor || c.color === filterColor;
      const matchType = !filterType || c.type === filterType;
      const matchLevel = !filterLevel || c.level === filterLevel;
      
      return matchText && matchColor && matchType && matchLevel;
    });
  }, [cards, search, filterColor, filterType, filterLevel]);

  const deckCardMap = useMemo(() => {
    const m = new Map<number, DeckCard>();
    for (const dc of deckCards) m.set(dc.cardId, dc);
    return m;
  }, [deckCards]);

  // パートナーと事件を取得
  const partnerCard = useMemo(() => {
    const partnerDc = deckCards.find(dc => {
      const card = cards.find(c => c.id === dc.cardId);
      return card?.type === "パートナー";
    });
    return partnerDc ? cards.find(c => c.id === partnerDc.cardId) : null;
  }, [deckCards, cards]);

  const incidentCard = useMemo(() => {
    const incidentDc = deckCards.find(dc => {
      const card = cards.find(c => c.id === dc.cardId);
      return card?.type === "事件";
    });
    return incidentDc ? cards.find(c => c.id === incidentDc.cardId) : null;
  }, [deckCards, cards]);

  // レベル分布の計算（グラフ用）
  const levelDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    LEVEL_OPTIONS.forEach(level => {
      dist[level] = 0;
    });
    
    deckCards.forEach(dc => {
      const card = cards.find(c => c.id === dc.cardId);
      if (card?.level && card.type !== "パートナー" && card.type !== "事件") {
        dist[card.level] = (dist[card.level] || 0) + dc.count;
      }
    });
    
    return dist;
  }, [deckCards, cards]);

  const maxLevelCount = useMemo(() => {
    return Math.max(...Object.values(levelDistribution), 1);
  }, [levelDistribution]);

  // キャラとイベントの枚数を計算
  const characterCount = useMemo(() => {
    return deckCards.reduce((sum, dc) => {
      const card = cards.find(c => c.id === dc.cardId);
      return card?.type === "キャラ" ? sum + dc.count : sum;
    }, 0);
  }, [deckCards, cards]);

  const eventCount = useMemo(() => {
    return deckCards.reduce((sum, dc) => {
      const card = cards.find(c => c.id === dc.cardId);
      return card?.type === "イベント" ? sum + dc.count : sum;
    }, 0);
  }, [deckCards, cards]);

  // レベル別にグループ化したカード（パートナーと事件を除く）
  const cardsByLevel = useMemo(() => {
    const grouped: Record<string, Array<{ card: Card; count: number }>> = {};
    LEVEL_OPTIONS.forEach(level => {
      grouped[level] = [];
    });

    deckCards.forEach(dc => {
      const card = cards.find(c => c.id === dc.cardId);
      if (card && card.type !== "パートナー" && card.type !== "事件" && card.level) {
        grouped[card.level].push({ card, count: dc.count });
      }
    });

    return grouped;
  }, [deckCards, cards]);

  // カード選択モーダル用のフィルタリングされたカード一覧
  const filteredCardsForModal = useMemo(() => {
    const q = cardSelectSearch.trim().toLowerCase();
    return cards.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const num = (c.number ?? "").toLowerCase();
      const matchText = !q || name.includes(q) || num.includes(q);
      const matchColor = !cardSelectColor || c.color === cardSelectColor;
      const matchType = !cardSelectType || c.type === cardSelectType;
      const matchLevel = !cardSelectLevel || c.level === cardSelectLevel;
      
      return matchText && matchColor && matchType && matchLevel;
    });
  }, [cards, cardSelectSearch, cardSelectColor, cardSelectType, cardSelectLevel]);

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

  function openEditCard(card: Card) {
    setEditingCard(card);
    setEditForm({
      name: card.name,
      number: card.number,
      color: card.color,
      type: card.type,
      level: card.level,
      memo: card.memo,
    });
    setEditImageFile(null);
  }

  function closeEditCard() {
    setEditingCard(null);
    setEditForm({});
    setEditImageFile(null);
  }

  // デッキカード編集を開く
  function openEditDeckCard(cardId: number) {
    const dc = deckCardMap.get(cardId);
    if (!dc) return;
    setEditingDeckCard({ cardId, count: dc.count });
  }

  // デッキカード編集を閉じる
  function closeEditDeckCard() {
    setEditingDeckCard(null);
  }

  // デッキカード枚数を増やす
  async function incrementDeckCard() {
    if (!editingDeckCard || activeDeckId == null) return;

    if (totalInDeck >= TARGET_DECK_SIZE) {
      alert("デッキが40枚に達しています。");
      return;
    }

    // 追加しようとしているカードの情報を取得
    const cardToAdd = cards.find(c => c.id === editingDeckCard.cardId);
    if (!cardToAdd || !cardToAdd.number) {
      alert("カード番号が設定されていないカードは追加できません。");
      return;
    }

    // 同じカード番号を持つカードの合計枚数をチェック
    const sameNumberCards = cards.filter(c => c.number === cardToAdd.number);
    const sameNumberCardIds = sameNumberCards.map(c => c.id).filter((id): id is number => id !== undefined);
    
    let totalCountOfSameNumber = 0;
    for (const id of sameNumberCardIds) {
      const dc = deckCardMap.get(id);
      if (dc) {
        totalCountOfSameNumber += dc.count;
      }
    }

    if (totalCountOfSameNumber >= SAME_NAME_LIMIT) {
      alert(`カード番号「${cardToAdd.number}」のカードは最大3枚までです。`);
      return;
    }

    const nextCount = editingDeckCard.count + 1;

    const found = await db.deckCards
      .where("[deckId+cardId]")
      .equals([activeDeckId, editingDeckCard.cardId])
      .first();

    if (found?.id) {
      await db.deckCards.update(found.id, { count: nextCount, synced: false });
    }

    setEditingDeckCard({ ...editingDeckCard, count: nextCount });
    await refreshAll();
  }

  // デッキカード枚数を減らす
  async function decrementDeckCard() {
    if (!editingDeckCard || activeDeckId == null) return;

    const nextCount = editingDeckCard.count - 1;

    const found = await db.deckCards
      .where("[deckId+cardId]")
      .equals([activeDeckId, editingDeckCard.cardId])
      .first();

    if (!found?.id) return;

    if (nextCount <= 0) {
      await db.deckCards.delete(found.id);
      closeEditDeckCard();
    } else {
      await db.deckCards.update(found.id, { count: nextCount, synced: false });
      setEditingDeckCard({ ...editingDeckCard, count: nextCount });
    }

    await refreshAll();
  }

  async function saveEditCard() {
    if (!editingCard?.id) return;

    const name = (editForm.name ?? "").trim();
    const number = (editForm.number ?? "").trim();
    
    if (!name) {
      alert("カード名は必須です。");
      return;
    }

    if (!number) {
      alert("カード番号は必須です。");
      return;
    }

    const imageBlob = editImageFile
      ? new Blob([await editImageFile.arrayBuffer()], { type: editImageFile.type })
      : editingCard.image;

    await db.cards.update(editingCard.id, {
      name,
      number,
      color: (editForm.color ?? "").trim() || undefined,
      type: (editForm.type ?? "").trim() || undefined,
      level: (editForm.level ?? "").trim().replace(/^Lv/, "") || undefined,
      memo: (editForm.memo ?? "").trim() || undefined,
      image: imageBlob,
      updatedAt: Date.now(),
      synced: false,
    });

    closeEditCard();
    await refreshAll();
  }

  async function addCardToDeck(cardId: number) {
    if (activeDeckId == null) return;

    if (totalInDeck >= TARGET_DECK_SIZE) {
      alert("デッキが40枚に達しています。減らしてから追加してください。");
      return;
    }

    // 追加しようとしているカードの情報を取得
    const cardToAdd = cards.find(c => c.id === cardId);
    if (!cardToAdd || !cardToAdd.number) {
      alert("カード番号が設定されていないカードは追加できません。");
      return;
    }

    // 同じカード番号を持つカードの合計枚数をチェック
    const sameNumberCards = cards.filter(c => c.number === cardToAdd.number);
    const sameNumberCardIds = sameNumberCards.map(c => c.id).filter((id): id is number => id !== undefined);
    
    let totalCountOfSameNumber = 0;
    for (const id of sameNumberCardIds) {
      const dc = deckCardMap.get(id);
      if (dc) {
        totalCountOfSameNumber += dc.count;
      }
    }

    if (totalCountOfSameNumber >= SAME_NAME_LIMIT) {
      alert(`カード番号「${cardToAdd.number}」のカードは最大3枚までです。`);
      return;
    }

    const existing = deckCardMap.get(cardId);
    const nextCount = (existing?.count ?? 0) + 1;

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

  // カード選択モーダルを開く
  function openCardSelectModal(filter: "all" | "partner" | "incident") {
    setCardSelectFilter(filter);
    setCardSelectSearch("");
    setCardSelectColor("");
    setCardSelectType(filter === "partner" ? "パートナー" : filter === "incident" ? "事件" : "");
    setCardSelectLevel("");
    setShowCardSelectModal(true);
  }

  // カード選択モーダルを閉じる
  function closeCardSelectModal() {
    setShowCardSelectModal(false);
  }

  // モーダルからカードを選択してデッキに追加
  async function selectCardFromModal(cardId: number) {
    await addCardToDeck(cardId);
    if (cardSelectFilter === "partner" || cardSelectFilter === "incident") {
      closeCardSelectModal();
    }
  }

  async function saveCard() {
    const name = (form.name ?? "").trim();
    const number = (form.number ?? "").trim();
    
    if (!name) {
      alert("カード名は必須です。");
      return;
    }

    if (!number) {
      alert("カード番号は必須です。");
      return;
    }

    const imageBlob = imageFile
      ? new Blob([await imageFile.arrayBuffer()], { type: imageFile.type })
      : undefined;

    await db.cards.add({
      name,
      number,
      color: (form.color ?? "").trim() || undefined,
      type: (form.type ?? "").trim() || undefined,
      level: (form.level ?? "").trim().replace(/^Lv/, "") || undefined,
      memo: (form.memo ?? "").trim() || undefined,
      image: imageBlob,
      updatedAt: Date.now(),
      synced: false,
    });

    setForm({ 
      name: "", 
      number: "", 
      color: "黄", 
      type: "キャラ", 
      level: "1",
      memo: "" 
    });
    setImageFile(null);
    setShowCardForm(false);
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
    await refreshAll();
  }

  async function renameDeck(deckId: number) {
    const deck = decks.find((d) => d.id === deckId);
    const current = deck?.name ?? "";

    const name = prompt("新しいデッキ名", current)?.trim();
    if (!name) return;

    await db.decks.update(deckId, { name, synced: false });
    await refreshAll();
  }

  async function renameActiveDeck() {
    if (activeDeckId == null) return;
    await renameDeck(activeDeckId);
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

  function toggleMobileMenu() {
    setMobileMenuOpen(!mobileMenuOpen);
  }

  function switchTab(tab: "cards" | "decks" | "editor" | "sync") {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  }

  const activeDeck = decks.find((d) => d.id === activeDeckId);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-logo">🃏 Conan Card Deck</div>
        <button className="menu-toggle" onClick={toggleMobileMenu}>☰</button>
      </header>

      {mobileMenuOpen && (
        <div 
          className="mobile-menu-overlay" 
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 200,
          }}
        >
          <div 
            className="mobile-menu"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: "68px",
              left: 0,
              right: 0,
              background: "white",
              padding: "1rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 201,
            }}
          >
            <button onClick={() => switchTab("cards")} style={{
              width: "100%", padding: "1rem", marginBottom: "0.5rem",
              border: activeTab === "cards" ? "2px solid #667eea" : "2px solid #e0e0e0",
              background: activeTab === "cards" ? "#f5f7fa" : "white",
              borderRadius: "8px", fontSize: "1rem",
              fontWeight: activeTab === "cards" ? "bold" : "normal", textAlign: "left",
            }}>🃏 カード管理</button>
            <button onClick={() => switchTab("decks")} style={{
              width: "100%", padding: "1rem", marginBottom: "0.5rem",
              border: activeTab === "decks" ? "2px solid #667eea" : "2px solid #e0e0e0",
              background: activeTab === "decks" ? "#f5f7fa" : "white",
              borderRadius: "8px", fontSize: "1rem",
              fontWeight: activeTab === "decks" ? "bold" : "normal", textAlign: "left",
            }}>📦 デッキ一覧</button>
            <button onClick={() => switchTab("editor")} style={{
              width: "100%", padding: "1rem", marginBottom: "0.5rem",
              border: activeTab === "editor" ? "2px solid #667eea" : "2px solid #e0e0e0",
              background: activeTab === "editor" ? "#f5f7fa" : "white",
              borderRadius: "8px", fontSize: "1rem",
              fontWeight: activeTab === "editor" ? "bold" : "normal", textAlign: "left",
            }}>✏️ デッキ編集</button>
            <button onClick={() => switchTab("sync")} style={{
              width: "100%", padding: "1rem",
              border: activeTab === "sync" ? "2px solid #667eea" : "2px solid #e0e0e0",
              background: activeTab === "sync" ? "#f5f7fa" : "white",
              borderRadius: "8px", fontSize: "1rem",
              fontWeight: activeTab === "sync" ? "bold" : "normal", textAlign: "left",
            }}>☁️ 同期</button>
          </div>
        </div>
      )}

      <nav className="app-nav">
        <ul className="nav-tabs">
          <li><button className={`nav-tab-button ${activeTab === "cards" ? "active" : ""}`} onClick={() => setActiveTab("cards")}>カード管理</button></li>
          <li><button className={`nav-tab-button ${activeTab === "decks" ? "active" : ""}`} onClick={() => setActiveTab("decks")}>デッキ一覧</button></li>
          <li><button className={`nav-tab-button ${activeTab === "editor" ? "active" : ""}`} onClick={() => setActiveTab("editor")}>デッキ編集</button></li>
          <li><button className={`nav-tab-button ${activeTab === "sync" ? "active" : ""}`} onClick={() => setActiveTab("sync")}>☁️ 同期</button></li>
        </ul>
      </nav>

      {editingCard && (
        <div className="modal-overlay" onClick={closeEditCard}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>カードを編集</span>
              <button className="modal-close" onClick={closeEditCard}>✕</button>
            </div>
            <div className="form-grid">
              <input type="text" placeholder="カード名（必須）" value={editForm.name ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, name: e.target.value }))} />
              <div className="form-row">
                <input type="text" placeholder="カード番号（必須）" value={editForm.number ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, number: e.target.value }))} />
                <select value={editForm.color ?? "黄"} onChange={(e) => setEditForm((p: any) => ({ ...p, color: e.target.value }))}>
                  {COLOR_OPTIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-row">
                <select value={editForm.type ?? "キャラ"} onChange={(e) => setEditForm((p: any) => ({ ...p, type: e.target.value }))}>
                  {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
                <select value={editForm.level ?? "1"} onChange={(e) => setEditForm((p: any) => ({ ...p, level: e.target.value }))}>
                  {LEVEL_OPTIONS.map(l => <option key={l}>Lv{l}</option>)}
                </select>
              </div>
              <textarea placeholder="メモ（任意）" value={editForm.memo ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, memo: e.target.value }))} rows={3} />
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>画像を変更（任意）</label>
                <input type="file" accept="image/*" onChange={(e) => setEditImageFile(e.target.files?.[0] ?? null)} />
                {editImageFile && <img src={URL.createObjectURL(editImageFile)} alt="プレビュー" className="image-preview" />}
                {!editImageFile && editingCard.image && <div style={{ marginTop: "0.5rem", color: "#666", fontSize: "0.9rem" }}>現在の画像を保持（変更する場合は上で選択）</div>}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeEditCard}>キャンセル</button>
              <button className="btn-primary" onClick={saveEditCard}>✅ 保存</button>
            </div>
          </div>
        </div>
      )}

      {/* デッキカード枚数編集モーダル */}
      {editingDeckCard && (
        <div className="modal-overlay" onClick={closeEditDeckCard}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
            <div className="modal-header">
              <span>枚数を変更</span>
              <button className="modal-close" onClick={closeEditDeckCard}>✕</button>
            </div>
            {(() => {
              const card = cards.find(c => c.id === editingDeckCard.cardId);
              return (
                <div style={{ textAlign: "center" }}>
                  <Thumb blob={card?.image} alt={card?.name ?? "card"} size="large" />
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", margin: "1rem 0" }}>
                    {card?.name}
                  </div>
                  <div style={{ color: "#666", marginBottom: "1.5rem" }}>
                    {card?.number ? `No.${card.number}` : ""}
                    {card?.type ? ` • ${card.type}` : ""}
                    {card?.level ? ` • Lv${card.level}` : ""}
                  </div>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1.5rem",
                    fontSize: "1.5rem"
                  }}>
                    <button
                      onClick={decrementDeckCard}
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "50%",
                        border: "2px solid #667eea",
                        background: "white",
                        fontSize: "1.5rem",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = "#667eea"}
                      onMouseOut={(e) => e.currentTarget.style.background = "white"}
                    >
                      −
                    </button>
                    <div style={{
                      fontSize: "2.5rem",
                      fontWeight: "bold",
                      color: "#667eea",
                      minWidth: "60px"
                    }}>
                      {editingDeckCard.count}
                    </div>
                    <button
                      onClick={incrementDeckCard}
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "50%",
                        border: "2px solid #667eea",
                        background: "white",
                        fontSize: "1.5rem",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = "#667eea"}
                      onMouseOut={(e) => e.currentTarget.style.background = "white"}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })()}
            <div className="modal-actions" style={{ marginTop: "2rem" }}>
              <button className="btn-primary" onClick={closeEditDeckCard} style={{ width: "100%" }}>
                完了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* カード選択モーダル */}
      {showCardSelectModal && (
        <div className="modal-overlay" onClick={closeCardSelectModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "900px", maxHeight: "90vh" }}>
            <div className="modal-header">
              <span>{cardSelectFilter === "partner" ? "パートナーを選択" : cardSelectFilter === "incident" ? "事件を選択" : "カードを追加"}</span>
              <button className="modal-close" onClick={closeCardSelectModal}>✕</button>
            </div>

            {/* 検索・フィルター */}
            <div style={{ marginBottom: "1rem" }}>
              <div className="search-bar" style={{ marginBottom: "0.75rem" }}>
                <input 
                  type="text" 
                  placeholder="🔍 カード名・番号で検索..." 
                  value={cardSelectSearch} 
                  onChange={(e) => setCardSelectSearch(e.target.value)} 
                />
              </div>
              {cardSelectFilter === "all" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                  <select value={cardSelectColor} onChange={(e) => setCardSelectColor(e.target.value)}>
                    <option value="">色: 全て</option>
                    {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={cardSelectType} onChange={(e) => setCardSelectType(e.target.value)}>
                    <option value="">種類: 全て</option>
                    <option value="キャラ">キャラ</option>
                    <option value="イベント">イベント</option>
                  </select>
                  <select value={cardSelectLevel} onChange={(e) => setCardSelectLevel(e.target.value)}>
                    <option value="">レベル: 全て</option>
                    {LEVEL_OPTIONS.map(l => <option key={l} value={l}>Lv{l}</option>)}
                  </select>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem" }}>
                  <select value={cardSelectColor} onChange={(e) => setCardSelectColor(e.target.value)}>
                    <option value="">色: 全て</option>
                    {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* カード一覧 */}
            <div style={{ maxHeight: "500px", overflowY: "auto" }}>
              {filteredCardsForModal.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div>カードが見つかりません</div>
                </div>
              ) : (
                <div className="cards-grid">
                  {filteredCardsForModal.map((card) => {
                    const inDeck = deckCardMap.get(card.id!);
                    return (
                      <div
                        key={card.id}
                        className="card-item"
                        onClick={() => selectCardFromModal(card.id!)}
                        style={{
                          opacity: inDeck ? 0.7 : 1,
                          border: inDeck ? "3px solid #667eea" : "2px solid #e0e0e0"
                        }}
                      >
                        <Thumb blob={card.image} alt={card.name ?? "card"} size="large" />
                        {card.color && <div className="card-color-badge" style={{ backgroundColor: colorMap[card.color] }} />}
                        <div className="card-name">{card.name}</div>
                        <div className="card-number">{card.number ? `No.${card.number}` : ""}</div>
                        {inDeck && (
                          <div style={{
                            position: "absolute",
                            top: "8px",
                            left: "8px",
                            background: "rgba(102, 126, 234, 0.9)",
                            color: "white",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: "bold"
                          }}>
                            ×{inDeck.count}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="app-content">
        <div className={`screen ${activeTab === "cards" ? "active" : ""}`}>

          <div className="section">
            <div className="section-header">
              <h2 className="section-title">カード一覧</h2>
              <button className="btn-primary" onClick={() => setShowCardForm(!showCardForm)}>
                {showCardForm ? "✕ 閉じる" : "➕ カード追加"}
              </button>
            </div>

            {showCardForm && (
              <div className="form-grid" style={{ marginBottom: "1.5rem", background: "#f5f7fa", padding: "1rem", borderRadius: "8px" }}>
                <input type="text" placeholder="カード名（必須）" value={form.name ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, name: e.target.value }))} />
                <div className="form-row">
                  <input type="text" placeholder="カード番号（必須）" value={form.number ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, number: e.target.value }))} />
                  <select value={form.color ?? "黄"} onChange={(e) => setForm((p: any) => ({ ...p, color: e.target.value }))}>
                    {COLOR_OPTIONS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <select value={form.type ?? "キャラ"} onChange={(e) => setForm((p: any) => ({ ...p, type: e.target.value }))}>
                    {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <select value={form.level ?? "1"} onChange={(e) => setForm((p: any) => ({ ...p, level: e.target.value }))}>
                    {LEVEL_OPTIONS.map(l => <option key={l}>Lv{l}</option>)}
                  </select>
                </div>
                <textarea placeholder="メモ（任意）" value={form.memo ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, memo: e.target.value }))} rows={3} />
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                <button className="btn-primary" onClick={saveCard}>✅ カードを保存</button>
              </div>
            )}

            <div className="search-bar">
              <input type="text" placeholder="🔍 カード名・番号で検索..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="form-grid" style={{ marginTop: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)}>
                <option value="">色: 全て</option>
                {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">種類: 全て</option>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
                <option value="">レベル: 全て</option>
                {LEVEL_OPTIONS.map(l => <option key={l} value={l}>Lv{l}</option>)}
              </select>
            </div>
            {filteredCards.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🃏</div>
                <div>カードが見つかりません</div>
                <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>検索条件を変更してください</div>
              </div>
            ) : (
              <div className="cards-grid">
                {filteredCards.map((c) => (
                  <div key={c.id} className="card-item">
                    {c.color && <div className="card-color-badge" style={{ background: colorMap[c.color] || "#9e9e9e" }} />}
                    <Thumb blob={c.image} alt={c.name ?? "card"} size="large" />
                    <div className="card-name">{c.name}</div>
                    <div className="card-number">
                      {c.number ? `No.${c.number}` : ""}
                      {c.type ? ` • ${c.type}` : ""}
                      {c.level ? ` • Lv${c.level}` : ""}
                    </div>
                    <div className="card-actions">
                      <button className="btn-secondary" style={{ padding: "0.5rem" }} onClick={() => openEditCard(c)}>✏️ 編集</button>
                      <button className="btn-primary" style={{ flex: 1, padding: "0.5rem" }} onClick={() => addCardToDeck(c.id!)}>➕ デッキへ</button>
                      <button className="btn-danger btn-icon" onClick={() => deleteCard(c.id!)}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`screen ${activeTab === "decks" ? "active" : ""}`}>
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">デッキ管理</h2>
              <button className="btn-primary" onClick={createDeck}>➕ 新規デッキ作成</button>
            </div>
            <div className="deck-list">
              {decks.map((d) => (
                <div key={d.id} className={`deck-chip ${d.id === activeDeckId ? "active" : ""}`} onClick={() => { setActiveDeckId(d.id!); setActiveTab("editor"); }} onDoubleClick={() => renameDeck(d.id!)} title="クリックで選択・ダブルクリックでリネーム">
                  <span>{d.name}</span>
                  <button className="deck-delete-btn" onClick={(e) => { e.stopPropagation(); deleteDeck(d.id!); }} title="削除">✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`screen ${activeTab === "editor" ? "active" : ""}`}>
          {activeDeck ? (
            <>
              {/* ヘッダー: パートナー、事件、グラフ、統計 */}
              <div style={{
                background: "white",
                border: "2px solid #e0e0e0",
                borderRadius: "12px",
                padding: "1.5rem",
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "2rem",
                flexWrap: "wrap"
              }}>
                {/* パートナー */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#666" }}>パートナー</div>
                  <div style={{
                    width: "100px",
                    height: "140px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: "2px solid #e0e0e0",
                    background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }} onClick={() => {
                    openCardSelectModal("partner");
                  }}>
                    {partnerCard?.image ? (
                      <img src={URL.createObjectURL(partnerCard.image)} alt={partnerCard.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ fontSize: "2rem", opacity: 0.3 }}>🃏</div>
                    )}
                  </div>
                  {partnerCard && <div style={{ fontSize: "0.8rem", color: "#999", textAlign: "center" }}>{partnerCard.name}</div>}
                </div>

                {/* 事件 */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#666" }}>事件</div>
                  <div style={{
                    width: "100px",
                    height: "140px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: "2px solid #e0e0e0",
                    background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }} onClick={() => {
                    openCardSelectModal("incident");
                  }}>
                    {incidentCard?.image ? (
                      <img src={URL.createObjectURL(incidentCard.image)} alt={incidentCard.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ fontSize: "2rem", opacity: 0.3 }}>🃏</div>
                    )}
                  </div>
                  {incidentCard && <div style={{ fontSize: "0.8rem", color: "#999", textAlign: "center" }}>{incidentCard.name}</div>}
                </div>

                {/* レベル分布グラフ */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#666", textAlign: "center" }}>レベル</div>
                  <div style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "0.25rem",
                    height: "100px",
                    padding: "0.5rem",
                    background: "linear-gradient(135deg, #fff0f3 0%, #ffe4e8 100%)",
                    borderRadius: "8px",
                    border: "2px solid #ffd4dc"
                  }}>
                    {LEVEL_OPTIONS.map((level) => {
                      const count = levelDistribution[level] || 0;
                      const height = maxLevelCount > 0 ? (count / maxLevelCount) * 70 : 0;
                      
                      return (
                        <div key={level} style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "0.25rem",
                          minWidth: "28px"
                        }}>
                          <div style={{
                            fontSize: "0.7rem",
                            fontWeight: "bold",
                            color: count > 0 ? "#ff9a9e" : "#ccc",
                            minHeight: "1rem"
                          }}>
                            {count > 0 ? count : ""}
                          </div>
                          <div style={{
                            width: "100%",
                            height: `${height}px`,
                            background: count > 0 ? "linear-gradient(180deg, #ff9a9e 0%, #fad0c4 100%)" : "#e0e0e0",
                            borderRadius: "3px 3px 0 0",
                            transition: "all 0.3s ease",
                            minHeight: "3px"
                          }} />
                          <div style={{
                            fontSize: "0.65rem",
                            fontWeight: "bold",
                            color: "#666"
                          }}>
                            {level}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 統計情報 */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: "200px" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#d4716b" }}>{activeDeck.name}</div>
                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "0.95rem" }}>
                      <span style={{ color: "#666" }}>キャラ:</span> <strong style={{ fontSize: "1.1rem", color: "#667eea" }}>{characterCount}</strong>
                    </div>
                    <div style={{ fontSize: "0.95rem" }}>
                      <span style={{ color: "#666" }}>イベント:</span> <strong style={{ fontSize: "1.1rem", color: "#ff9a9e" }}>{eventCount}</strong>
                    </div>
                    <div style={{ fontSize: "0.95rem" }}>
                      <span style={{ color: "#666" }}>デッキ:</span> <strong style={{ fontSize: "1.1rem", color: totalInDeck === TARGET_DECK_SIZE ? "#43a047" : "#333" }}>{totalInDeck}/{TARGET_DECK_SIZE}</strong>
                    </div>
                  </div>
                  <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.9rem", alignSelf: "flex-start" }} onClick={renameActiveDeck}>✏️ 名前変更</button>
                </div>
              </div>

              {totalInDeck === TARGET_DECK_SIZE && (
                <div className="success-panel info-panel">
                  <div className="info-panel-title">✅ デッキ完成！</div>
                  <div className="info-panel-text">40枚のデッキが完成しました。対戦の準備ができています！</div>
                </div>
              )}

              {/* レベル別カードグリッド */}
              <div className="section">
                <div className="section-header">
                  <h2 className="section-title">デッキ内カード</h2>
                  <button className="btn-primary" onClick={() => openCardSelectModal("all")}>➕ カード追加</button>
                </div>
                {deckCards.filter(dc => {
                  const card = cards.find(c => c.id === dc.cardId);
                  return card?.type !== "パートナー" && card?.type !== "事件";
                }).length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <div>デッキにカードがありません</div>
                    <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>「カード管理」タブからカードを追加してください</div>
                  </div>
                ) : (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                    gap: "0.75rem",
                    padding: "1rem 0"
                  }}>
                    {/* レベル順にソートしてから全カードを表示 */}
                    {LEVEL_OPTIONS.flatMap((level) => 
                      cardsByLevel[level].map(({ card, count }) => (
                        <div
                          key={card.id}
                          onClick={() => openEditDeckCard(card.id!)}
                          style={{
                            position: "relative",
                            cursor: "pointer",
                            borderRadius: "8px",
                            overflow: "visible",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                            transition: "transform 0.2s, box-shadow 0.2s"
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = "translateY(-4px)";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                          }}
                        >
                          <div style={{ aspectRatio: "0.7", position: "relative", borderRadius: "8px", overflow: "hidden" }}>
                            {card.image ? (
                              <img
                                src={URL.createObjectURL(card.image)}
                                alt={card.name}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover"
                                }}
                              />
                            ) : (
                              <div style={{
                                width: "100%",
                                height: "100%",
                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontSize: "2rem"
                              }}>
                                🃏
                              </div>
                            )}
                            {/* 枚数バッジ（カード上にオーバーレイ） */}
                            <div style={{
                              position: "absolute",
                              bottom: "6px",
                              right: "6px",
                              background: "rgba(0, 0, 0, 0.85)",
                              color: "white",
                              borderRadius: "50%",
                              width: "32px",
                              height: "32px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.9rem",
                              fontWeight: "bold",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                              border: "2px solid white"
                            }}>
                              ×{count}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🎴</div>
              <div>デッキを選択してください</div>
              <div style={{ marginTop: "1rem" }}>
                <button className="btn-primary" onClick={createDeck}>➕ 新しいデッキを作成</button>
              </div>
            </div>
          )}
        </div>

        <div className={`screen ${activeTab === "sync" ? "active" : ""}`}>
          <div className="info-panel">
            <div className="info-panel-title">☁️ クラウド同期</div>
            <div className="info-panel-text">Supabaseを使って、PC・スマホ間でデータを同期できます。</div>
          </div>
          {syncMessage && (
            <div className="info-panel" style={{ 
              background: syncMessage.includes("✅") ? "linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%)" 
                : syncMessage.includes("❌") ? "linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)"
                : "linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)"
            }}>
              <div className="info-panel-text" style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{syncMessage}</div>
            </div>
          )}
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">同期操作</h2>
            </div>
            <div className="form-grid">
              <button className="btn-primary" onClick={handleFullSync} disabled={syncing} style={{ fontSize: "1.1rem", padding: "1rem" }}>🔄 完全同期（おすすめ）</button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <button className="btn-secondary" onClick={handleDownloadSync} disabled={syncing}>⬇️ クラウドから取得</button>
                <button className="btn-secondary" onClick={handleUploadSync} disabled={syncing}>⬆️ クラウドへ保存</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
