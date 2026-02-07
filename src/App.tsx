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
        <img src={url} alt={alt} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
      </div>
    );
  }

  return (
    <div className="deck-card-thumb">
      <img src={url} alt={alt} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
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
  const [activeTab, setActiveTab] = useState<"cards" | "decks" | "editor" | "play" | "sync">(() => {
    // localStorageから前回のタブを復元
    const saved = localStorage.getItem("activeTab");
    console.log("activeTab初期化:", saved);
    if (saved && ["cards", "decks", "editor", "play", "sync"].includes(saved)) {
      console.log("復元:", saved);
      return saved as "cards" | "decks" | "editor" | "play" | "sync";
    }
    console.log("デフォルト: cards");
    return "cards";
  });
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

  // 一人回し用
  const [playDeckId, setPlayDeckId] = useState<number | null>(null);
  const [playDeck, setPlayDeck] = useState<Card[]>([]);
  const [playHand, setPlayHand] = useState<Card[]>([]);
  const [playDrawn, setPlayDrawn] = useState(0);
  const [playField, setPlayField] = useState<Card[]>([]); // 現場
  const [playRemove, setPlayRemove] = useState<Card[]>([]); // リムーブエリア
  const [isMulliganMode, setIsMulliganMode] = useState(false); // マリガン中かどうか
  const [mulliganDone, setMulliganDone] = useState(false); // マリガン済みかどうか
  const [selectedForMulligan, setSelectedForMulligan] = useState<number[]>([]); // マリガン選択中のカードindex
  
  // カードメニュー用
  const [showCardMenu, setShowCardMenu] = useState(false);
  const [selectedCard, setSelectedCard] = useState<{ card: Card; index: number; location: "hand" | "field" | "remove" } | null>(null);
  
  // カード拡大表示用
  const [showCardDetail, setShowCardDetail] = useState(false);
  const [detailCard, setDetailCard] = useState<Card | null>(null);

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

  const totalInDeck = useMemo(() => {
    // パートナーと事件を除いた枚数
    console.log("totalInDeck再計算:", { 
      deckCardsLength: deckCards?.length, 
      cardsLength: cards?.length 
    });
    
    if (!deckCards || deckCards.length === 0) {
      console.log("deckCardsが空");
      return 0;
    }
    if (!cards || cards.length === 0) {
      console.log("cardsが空");
      return 0;
    }
    
    const total = deckCards.reduce((sum, dc) => {
      const card = cards.find(c => c.id === dc.cardId);
      // パートナーと事件を除外
      if (card && card.type !== "パートナー" && card.type !== "事件") {
        return sum + dc.count;
      }
      return sum;
    }, 0);
    
    console.log("計算結果:", total);
    return total;
  }, [deckCards, cards]);

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

  function switchTab(tab: "cards" | "decks" | "editor" | "play" | "sync") {
    console.log("switchTab:", tab);
    setActiveTab(tab);
    localStorage.setItem("activeTab", tab); // タブを保存
    console.log("localStorage保存:", tab);
    setMobileMenuOpen(false);
  }

  // 一人回し機能
  async function startPlay(deckId: number) {
    console.log("startPlay開始:", deckId);
    
    // デッキカードを取得
    const dcs = await db.deckCards.where("deckId").equals(deckId).toArray();
    console.log("デッキカード取得:", dcs.length);
    
    // カード情報を取得し、デッキを構築（パートナーと事件を除く）
    const allPlayCards: Card[] = [];
    for (const dc of dcs) {
      const card = await db.cards.get(dc.cardId);
      console.log("カード取得:", card?.name, card?.type, "枚数:", dc.count);
      if (card && card.type !== "パートナー" && card.type !== "事件") {
        // 枚数分カードを追加
        for (let i = 0; i < dc.count; i++) {
          allPlayCards.push(card);
        }
      }
    }
    console.log("デッキ構築完了:", allPlayCards.length, "枚");

    // シャッフル（Fisher-Yatesアルゴリズム）
    const shuffled = [...allPlayCards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    console.log("シャッフル完了");

    // 最初の5枚を手札に
    const hand = shuffled.slice(0, 5);
    const deck = shuffled.slice(5);
    console.log("手札:", hand.length, "山札:", deck.length);

    setPlayDeckId(deckId);
    setPlayDeck(deck);
    setPlayHand(hand);
    setPlayDrawn(5);
    console.log("状態更新完了");
  }

  function drawCard() {
    if (playDeck.length === 0) {
      alert("デッキにカードがありません！");
      return;
    }

    const newCard = playDeck[0];
    const newDeck = playDeck.slice(1);
    
    setPlayHand([...playHand, newCard]);
    setPlayDeck(newDeck);
    setPlayDrawn(playDrawn + 1);
  }

  function playCardToField(index: number) {
    // マリガン中は現場に出せない
    if (isMulliganMode) return;
    
    // 手札から現場に出す
    const card = playHand[index];
    const newHand = playHand.filter((_, i) => i !== index);
    
    setPlayHand(newHand);
    setPlayField([...playField, card]);
    setShowCardMenu(false);
  }

  function moveCardToRemove(index: number) {
    // 現場からリムーブエリアに送る
    const card = playField[index];
    const newField = playField.filter((_, i) => i !== index);
    
    setPlayField(newField);
    setPlayRemove([...playRemove, card]);
    setShowCardMenu(false);
  }

  function openCardMenu(card: Card, index: number, location: "hand" | "field" | "remove") {
    setSelectedCard({ card, index, location });
    setShowCardMenu(true);
  }

  function closeCardMenu() {
    setShowCardMenu(false);
    setSelectedCard(null);
  }

  function handleMenuAction(action: "play" | "remove" | "view") {
    if (!selectedCard) return;

    switch (action) {
      case "play":
        if (selectedCard.location === "hand") {
          playCardToField(selectedCard.index);
        }
        break;
      case "remove":
        if (selectedCard.location === "field") {
          moveCardToRemove(selectedCard.index);
        }
        break;
      case "view":
        // 拡大表示
        setDetailCard(selectedCard.card);
        setShowCardDetail(true);
        closeCardMenu();
        break;
    }
  }

  function openCardDetail(card: Card) {
    setDetailCard(card);
    setShowCardDetail(true);
  }

  function closeCardDetail() {
    setShowCardDetail(false);
    setDetailCard(null);
  }

  function startMulligan() {
    const confirm = window.confirm("マリガンを開始しますか？");
    
    if (!confirm) return;
    
    setIsMulliganMode(true);
    setSelectedForMulligan([]);
  }

  function toggleMulliganSelect(index: number) {
    if (selectedForMulligan.includes(index)) {
      // 選択解除
      setSelectedForMulligan(selectedForMulligan.filter(i => i !== index));
    } else {
      // 選択追加（最大5枚まで）
      if (selectedForMulligan.length < 5) {
        setSelectedForMulligan([...selectedForMulligan, index]);
      }
    }
  }

  function cancelMulligan() {
    setIsMulliganMode(false);
    setSelectedForMulligan([]);
    setMulliganDone(true); // キャンセルしてもマリガン済み扱い
  }

  async function executeMulligan() {
    if (selectedForMulligan.length === 0) {
      alert("マリガンするカードを選択してください");
      return;
    }

    // 選択したカードを山札に戻す
    const cardsToReturn = selectedForMulligan.map(i => playHand[i]);
    const remainingHand = playHand.filter((_, i) => !selectedForMulligan.includes(i));

    // 山札に戻してシャッフル
    const newDeck = [...playDeck, ...cardsToReturn];
    
    // Fisher-Yatesシャッフル
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }

    // 同じ枚数ドロー
    const drawCount = selectedForMulligan.length;
    const drawnCards = newDeck.slice(0, drawCount);
    const finalDeck = newDeck.slice(drawCount);

    setPlayHand([...remainingHand, ...drawnCards]);
    setPlayDeck(finalDeck);
    setIsMulliganMode(false);
    setSelectedForMulligan([]);
    setMulliganDone(true);
  }

  function resetPlay() {
    setPlayDeckId(null);
    setPlayDeck([]);
    setPlayHand([]);
    setPlayDrawn(0);
    setPlayField([]);
    setPlayRemove([]);
    setIsMulliganMode(false);
    setMulliganDone(false);
    setSelectedForMulligan([]);
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
            }}>🃏 カード</button>
            <button onClick={() => switchTab("decks")} style={{
              width: "100%", padding: "1rem", marginBottom: "0.5rem",
              border: activeTab === "decks" ? "2px solid #667eea" : "2px solid #e0e0e0",
              background: activeTab === "decks" ? "#f5f7fa" : "white",
              borderRadius: "8px", fontSize: "1rem",
              fontWeight: activeTab === "decks" ? "bold" : "normal", textAlign: "left",
            }}>📦 デッキ</button>
            <button onClick={() => switchTab("play")} style={{
              width: "100%", padding: "1rem", marginBottom: "0.5rem",
              border: activeTab === "play" ? "2px solid #667eea" : "2px solid #e0e0e0",
              background: activeTab === "play" ? "#f5f7fa" : "white",
              borderRadius: "8px", fontSize: "1rem",
              fontWeight: activeTab === "play" ? "bold" : "normal", textAlign: "left",
            }}>🎮 一人回し</button>
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
          <li><button className={`nav-tab-button ${activeTab === "cards" ? "active" : ""}`} onClick={() => switchTab("cards")}>カード</button></li>
          <li><button className={`nav-tab-button ${activeTab === "decks" ? "active" : ""}`} onClick={() => switchTab("decks")}>デッキ</button></li>
          <li><button className={`nav-tab-button ${activeTab === "play" ? "active" : ""}`} onClick={() => switchTab("play")}>🎮 一人回し</button></li>
          <li><button className={`nav-tab-button ${activeTab === "sync" ? "active" : ""}`} onClick={() => switchTab("sync")}>☁️ 同期</button></li>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "350px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <span>枚数を変更</span>
              <button className="modal-close" onClick={closeEditDeckCard}>✕</button>
            </div>
            {(() => {
              const card = cards.find(c => c.id === editingDeckCard.cardId);
              if (!card) return null;
              
              return (
                <div>
                  {/* 枚数調整と完了ボタン（上部・一行） */}
                  <div style={{
                    padding: "0.75rem",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    borderRadius: "12px",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem"
                  }}>
                    {/* 枚数調整 */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      flex: 1
                    }}>
                      <button
                        onClick={decrementDeckCard}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          border: "2px solid white",
                          background: "rgba(255, 255, 255, 0.2)",
                          color: "white",
                          fontSize: "1.2rem",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          fontWeight: "bold"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)"}
                        onMouseOut={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"}
                      >
                        −
                      </button>
                      <div style={{
                        fontSize: "1.8rem",
                        fontWeight: "bold",
                        color: "white",
                        minWidth: "50px",
                        textAlign: "center"
                      }}>
                        ×{editingDeckCard.count}
                      </div>
                      <button
                        onClick={incrementDeckCard}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          border: "2px solid white",
                          background: "rgba(255, 255, 255, 0.2)",
                          color: "white",
                          fontSize: "1.2rem",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          fontWeight: "bold"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)"}
                        onMouseOut={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"}
                      >
                        +
                      </button>
                    </div>

                    {/* 完了ボタン */}
                    <button
                      onClick={closeEditDeckCard}
                      style={{
                        padding: "0.5rem 1.25rem",
                        background: "white",
                        color: "#667eea",
                        border: "none",
                        borderRadius: "20px",
                        fontSize: "1rem",
                        fontWeight: "bold",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        whiteSpace: "nowrap"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "#f0f0f0";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = "white";
                      }}
                    >
                      完了
                    </button>
                  </div>

                  {/* カード画像 */}
                  <div style={{
                    marginBottom: "1rem",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    maxWidth: "200px",
                    margin: "0 auto 1rem auto"
                  }}>
                    {card.image ? (
                      <img
                        src={URL.createObjectURL(card.image)}
                        alt={card.name}
                        style={{
                          width: "100%",
                          height: "auto",
                          display: "block"
                        }}
                      />
                    ) : (
                      <div style={{
                        aspectRatio: "0.7",
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
                  </div>

                  {/* カード情報 */}
                  <div style={{ marginBottom: "1.5rem" }}>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.75rem", color: "#333", textAlign: "center" }}>
                      {card.name}
                    </h2>
                    
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem", justifyContent: "center" }}>
                      {card.number && (
                        <span style={{
                          padding: "0.25rem 0.75rem",
                          background: "#e0e0e0",
                          borderRadius: "12px",
                          fontSize: "0.9rem",
                          fontWeight: "bold"
                        }}>
                          No.{card.number}
                        </span>
                      )}
                      {card.color && (
                        <span style={{
                          padding: "0.25rem 0.75rem",
                          background: colorMap[card.color],
                          color: "white",
                          borderRadius: "12px",
                          fontSize: "0.9rem",
                          fontWeight: "bold"
                        }}>
                          {card.color}
                        </span>
                      )}
                      {card.type && (
                        <span style={{
                          padding: "0.25rem 0.75rem",
                          background: "#667eea",
                          color: "white",
                          borderRadius: "12px",
                          fontSize: "0.9rem",
                          fontWeight: "bold"
                        }}>
                          {card.type}
                        </span>
                      )}
                      {card.level && (
                        <span style={{
                          padding: "0.25rem 0.75rem",
                          background: "#f093fb",
                          color: "white",
                          borderRadius: "12px",
                          fontSize: "0.9rem",
                          fontWeight: "bold"
                        }}>
                          Lv.{card.level}
                        </span>
                      )}
                    </div>

                    {card.memo && (
                      <div style={{
                        padding: "0.75rem",
                        background: "#f5f7fa",
                        borderRadius: "8px",
                        fontSize: "0.95rem",
                        color: "#666",
                        whiteSpace: "pre-wrap"
                      }}>
                        {card.memo}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
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
                        <div className="card-number" style={{ fontSize: "0.8rem" }}>
                          {card.number || "---"}
                          {card.type ? `/${card.type === "キャラ" ? "キ" : card.type === "イベント" ? "イ" : card.type === "パートナー" ? "パ" : "事"}` : ""}
                          {card.level ? `/${card.level}` : ""}
                        </div>
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
                {showCardForm ? "✕" : "➕"}
              </button>
            </div>

            {showCardForm && (
              <div className="form-grid" style={{ marginBottom: "1rem", background: "#f5f7fa", padding: "0.75rem", borderRadius: "8px" }}>
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
                <textarea placeholder="メモ（任意）" value={form.memo ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, memo: e.target.value }))} rows={2} />
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                <button className="btn-primary" onClick={saveCard}>✅ 保存</button>
              </div>
            )}

            {/* 検索とフィルターを1行に統合 */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "2fr 1fr 1fr 1fr", 
              gap: "0.4rem",
              marginBottom: "1rem"
            }}>
              <input 
                type="text" 
                placeholder="🔍 検索..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: "0.5rem",
                  border: "2px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "0.9rem"
                }}
              />
              <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)} style={{ fontSize: "0.85rem", padding: "0.5rem" }}>
                <option value="">色</option>
                {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ fontSize: "0.85rem", padding: "0.5rem" }}>
                <option value="">種類</option>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} style={{ fontSize: "0.85rem", padding: "0.5rem" }}>
                <option value="">Lv</option>
                {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            {filteredCards.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🃏</div>
                <div>カードが見つかりません</div>
                <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>検索条件を変更してください</div>
              </div>
            ) : (
              <div className="cards-grid" style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: "0.5rem"
              }}>
                {filteredCards.map((c) => (
                  <div key={c.id} className="card-item">
                    {c.color && <div className="card-color-badge" style={{ background: colorMap[c.color] || "#9e9e9e" }} />}
                    <div onClick={() => openCardDetail(c)} style={{ cursor: "pointer" }}>
                      <Thumb blob={c.image} alt={c.name ?? "card"} size="large" />
                    </div>
                    <div className="card-name">{c.name}</div>
                    <div className="card-number" style={{ fontSize: "0.8rem" }}>
                      {c.number || "---"}
                      {c.type ? `/${c.type === "キャラ" ? "キ" : c.type === "イベント" ? "イ" : c.type === "パートナー" ? "パ" : "事"}` : ""}
                      {c.level ? `/${c.level}` : ""}
                    </div>
                    <div className="card-actions">
                      <button className="btn-secondary" style={{ padding: "0.4rem", fontSize: "1.1rem" }} onClick={() => openEditCard(c)}>✏️</button>
                      <button className="btn-primary" style={{ flex: 1, padding: "0.4rem", fontSize: "1.1rem" }} onClick={() => addCardToDeck(c.id!)}>➕</button>
                      <button className="btn-danger btn-icon" style={{ padding: "0.4rem", fontSize: "1.1rem", background: "#ffb74d", borderColor: "#ffb74d" }} onClick={() => deleteCard(c.id!)}>🗑</button>
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
              <button className="btn-primary" onClick={createDeck}>➕</button>
            </div>
            <div className="deck-list">
              {decks.map((d) => (
                <div key={d.id} className={`deck-chip ${d.id === activeDeckId ? "active" : ""}`} onClick={() => { setActiveDeckId(d.id!); switchTab("editor"); }} onDoubleClick={() => renameDeck(d.id!)} title="クリックで選択・ダブルクリックでリネーム">
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
              {/* ヘッダー: パートナー、事件、統計情報を縦並び */}
              <div style={{
                background: "white",
                border: "2px solid #e0e0e0",
                borderRadius: "12px",
                padding: "0.75rem",
                marginBottom: "1rem",
                maxWidth: "600px",
                margin: "0 auto 1rem auto"
              }}>
                {/* 1行目：パートナーと事件 */}
                <div style={{
                  display: "flex",
                  gap: "1rem",
                  marginBottom: "0.75rem",
                  alignItems: "flex-start"
                }}>
                  {/* パートナー */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#666" }}>パートナー</div>
                    <div style={{
                      width: "70px",
                      height: "98px",
                      borderRadius: "6px",
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
                        <div style={{ fontSize: "1.5rem", opacity: 0.3 }}>🃏</div>
                      )}
                    </div>
                    {partnerCard && <div style={{ fontSize: "0.65rem", color: "#999", textAlign: "center", maxWidth: "70px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{partnerCard.name}</div>}
                  </div>

                  {/* 事件 */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#666" }}>事件</div>
                    <div style={{
                      width: "98px",
                      height: "70px",
                      borderRadius: "6px",
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
                      <div style={{ fontSize: "1.5rem", opacity: 0.3 }}>🃏</div>
                    )}
                  </div>
                  {incidentCard && <div style={{ fontSize: "0.65rem", color: "#999", textAlign: "center", maxWidth: "98px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{incidentCard.name}</div>}
                  </div>

                  {/* 統計情報（右側） */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", justifyContent: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ fontSize: "0.95rem", fontWeight: "bold", color: "#d4716b", flex: 1 }}>
                        {activeDeck.name}
                      </div>
                      <button className="btn-secondary" style={{ padding: "0.3rem 0.5rem", fontSize: "0.9rem" }} onClick={renameActiveDeck}>✏️</button>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <div style={{ fontSize: "0.8rem" }}>
                        <span style={{ color: "#666" }}>キャラ:</span> <strong style={{ fontSize: "0.9rem", color: "#667eea" }}>{characterCount}</strong>
                      </div>
                      <div style={{ fontSize: "0.8rem" }}>
                        <span style={{ color: "#666" }}>イベント:</span> <strong style={{ fontSize: "0.9rem", color: "#ff9a9e" }}>{eventCount}</strong>
                      </div>
                      <div style={{ fontSize: "0.8rem" }} key={`deck-count-${totalInDeck}`}>
                        <span style={{ color: "#666" }}>デッキ:</span> <strong style={{ fontSize: "0.9rem", color: totalInDeck === TARGET_DECK_SIZE ? "#43a047" : "#333" }}>{totalInDeck}/{TARGET_DECK_SIZE}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2行目：レベル分布グラフ */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#666" }}>レベル分布</div>
                  <div style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "0.2rem",
                    height: "60px",
                    padding: "0.4rem",
                    background: "linear-gradient(135deg, #fff0f3 0%, #ffe4e8 100%)",
                    borderRadius: "6px",
                    border: "2px solid #ffd4dc"
                  }}>
                    {LEVEL_OPTIONS.map((level) => {
                      const count = levelDistribution[level] || 0;
                      const height = maxLevelCount > 0 ? (count / maxLevelCount) * 40 : 0;
                      
                      return (
                        <div key={level} style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "0.15rem",
                          flex: 1
                        }}>
                          <div style={{
                            fontSize: "0.6rem",
                            fontWeight: "bold",
                            color: count > 0 ? "#ff9a9e" : "#ccc",
                            minHeight: "0.8rem"
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
              </div>

              {totalInDeck === TARGET_DECK_SIZE && (
                <div className="success-panel info-panel" style={{ padding: "0.75rem", marginBottom: "1rem", maxWidth: "600px", margin: "0 auto 1rem auto" }}>
                  <div className="info-panel-title" style={{ fontSize: "0.9rem" }}>✅ デッキ完成！</div>
                  <div className="info-panel-text" style={{ fontSize: "0.85rem" }}>40枚のデッキが完成しました。</div>
                </div>
              )}

              {/* レベル別カードグリッド */}
              <div className="section">
                <div className="section-header">
                  <h2 className="section-title">デッキ内カード</h2>
                  <button className="btn-primary" onClick={() => openCardSelectModal("all")}>➕</button>
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
                    gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                    gap: "0.5rem",
                    padding: "0.5rem 0"
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

        {/* 一人回し画面 */}
        <div className={`screen ${activeTab === "play" ? "active" : ""}`}>
          {playDeckId === null ? (
            // デッキ選択画面
            <div className="section">
              <div className="section-header">
                <h2 className="section-title">🎮 一人回し</h2>
              </div>
              <div className="info-panel">
                <div className="info-panel-title">デッキを選択してください</div>
                <div className="info-panel-text">
                  一人回しを開始するデッキを選んでください。
                </div>
              </div>
              
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                gap: "1rem",
                marginTop: "1.5rem"
              }}>
                {decks.map((deck) => {
                  // このデッキの枚数を計算（簡易版 - クリック時に正確にチェック）
                  return (
                    <div
                      key={deck.id}
                      onClick={async () => {
                        console.log("デッキクリック:", deck.id, deck.name);
                        // クリック時に正確な枚数を計算
                        const dcs = await db.deckCards.where("deckId").equals(deck.id!).toArray();
                        console.log("デッキカード数:", dcs.length);
                        let total = 0;
                        for (const dc of dcs) {
                          const card = await db.cards.get(dc.cardId);
                          if (card && card.type !== "パートナー" && card.type !== "事件") {
                            total += dc.count;
                          }
                        }
                        console.log("合計枚数:", total);
                        
                        if (total === TARGET_DECK_SIZE) {
                          console.log("40枚OK、startPlay呼び出し");
                          await startPlay(deck.id!);
                        } else {
                          alert(`デッキが40枚ではありません（現在${total}枚）`);
                        }
                      }}
                      style={{
                        padding: "1.5rem",
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        borderRadius: "12px",
                        cursor: "pointer",
                        color: "white",
                        transition: "transform 0.2s, box-shadow 0.2s",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.25)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                      }}
                    >
                      <div style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
                        {deck.name}
                      </div>
                      <div style={{ fontSize: "0.95rem", opacity: 0.9 }}>
                        クリックして開始
                      </div>
                    </div>
                  );
                })}
              </div>

              {decks.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">🎴</div>
                  <div>デッキがありません</div>
                  <div style={{ marginTop: "1rem" }}>
                    <button className="btn-primary" onClick={createDeck}>➕ 新しいデッキを作成</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // プレイ画面
            <div className="section">
              <div className="section-header">
                <h2 className="section-title">
                  🎮 {decks.find(d => d.id === playDeckId)?.name ?? "一人回し"}
                </h2>
                <button className="btn-secondary" onClick={resetPlay}>
                  🔙 デッキ選択に戻る
                </button>
              </div>

              {/* 統計情報 */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.4rem",
                marginBottom: "0.5rem"
              }}>
                <div style={{
                  padding: "0.4rem",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: "6px",
                  color: "white",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "0.65rem", opacity: 0.9 }}>手札</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{playHand.length}</div>
                </div>
                <div style={{
                  padding: "0.4rem",
                  background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
                  borderRadius: "6px",
                  color: "white",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "0.65rem", opacity: 0.9 }}>現場</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{playField.length}</div>
                </div>
                <div style={{
                  padding: "0.4rem",
                  background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                  borderRadius: "6px",
                  color: "white",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "0.65rem", opacity: 0.9 }}>リムーブ</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{playRemove.length}</div>
                </div>
                <div style={{
                  padding: "0.4rem",
                  background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                  borderRadius: "6px",
                  color: "white",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "0.65rem", opacity: 0.9 }}>山札</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{playDeck.length}</div>
                </div>
                <div style={{
                  padding: "0.4rem",
                  background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                  borderRadius: "6px",
                  color: "white",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "0.65rem", opacity: 0.9 }}>ドロー</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{playDrawn}</div>
                </div>
                {/* 空のセル（レイアウト調整用） */}
                <div style={{ padding: "0.4rem" }}></div>
              </div>

              {/* ドローボタン */}
              <div style={{ marginBottom: "0.75rem" }}>
                {isMulliganMode ? (
                  // マリガンモード中
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button 
                      className="btn-secondary" 
                      onClick={cancelMulligan}
                      style={{ 
                        flex: 1,
                        padding: "0.75rem",
                        fontSize: "1rem"
                      }}
                    >
                      ❌ キャンセル
                    </button>
                    <button 
                      className="btn-primary" 
                      onClick={executeMulligan}
                      style={{ 
                        flex: 2,
                        padding: "0.75rem",
                        fontSize: "1rem"
                      }}
                    >
                      ✅ マリガン実行 ({selectedForMulligan.length}枚)
                    </button>
                  </div>
                ) : (
                  // 通常モード
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button 
                      className="btn-primary" 
                      onClick={drawCard}
                      disabled={playDeck.length === 0}
                      style={{ 
                        flex: 2,
                        padding: "0.75rem",
                        fontSize: "1.1rem",
                        opacity: playDeck.length === 0 ? 0.5 : 1
                      }}
                    >
                      🎴 カードをドロー
                    </button>
                    {!mulliganDone && (
                      <button 
                        className="btn-secondary" 
                        onClick={startMulligan}
                        style={{ 
                          flex: 1,
                          padding: "0.75rem",
                          fontSize: "1rem"
                        }}
                      >
                        🔄 マリガン
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* マリガン説明 */}
              {isMulliganMode && (
                <div style={{
                  padding: "0.75rem",
                  background: "linear-gradient(135deg, #fff9c4 0%, #fff59d 100%)",
                  borderRadius: "8px",
                  marginBottom: "0.75rem",
                  border: "2px solid #fbc02d"
                }}>
                  <div style={{ fontWeight: "bold", marginBottom: "0.25rem", color: "#f57f17", fontSize: "0.9rem" }}>
                    🔄 マリガン中
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#f57f17" }}>
                    手札から戻したいカードを選択してください（最大5枚）
                  </div>
                </div>
              )}

              {/* リムーブエリア */}
              <div style={{ marginBottom: "1rem" }}>
                <div className="section-header" style={{ marginBottom: "0.5rem" }}>
                  <h3 className="section-title">🗑️ リムーブエリア</h3>
                </div>
                {playRemove.length === 0 ? (
                  <div style={{
                    padding: "1rem",
                    background: "#f5f5f5",
                    borderRadius: "8px",
                    textAlign: "center",
                    color: "#999",
                    fontSize: "0.9rem"
                  }}>
                    リムーブエリアは空です
                  </div>
                ) : (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                    gap: "0.5rem",
                    padding: "0.75rem",
                    background: "#f5f5f5",
                    borderRadius: "8px"
                  }}>
                    {playRemove.map((card, idx) => (
                      <div
                        key={`remove-${card.id}-${idx}`}
                        onClick={() => openCardMenu(card, idx, "remove")}
                        style={{
                          borderRadius: "8px",
                          overflow: "hidden",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          opacity: 0.8,
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ aspectRatio: "0.7", position: "relative" }}>
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
                              background: `linear-gradient(135deg, ${colorMap[card.color ?? "黄"]} 0%, ${colorMap[card.color ?? "黄"]}dd 100%)`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexDirection: "column",
                              color: "white",
                              padding: "0.25rem"
                            }}>
                              <div style={{ fontSize: "0.55rem", marginBottom: "0.1rem" }}>
                                Lv.{card.level}
                              </div>
                              <div style={{ fontSize: "0.65rem", fontWeight: "bold", textAlign: "center", lineHeight: "1.1" }}>
                                {card.name}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 現場（フィールド） */}
              <div style={{ marginBottom: "1rem" }}>
                <div className="section-header" style={{ marginBottom: "0.5rem" }}>
                  <h3 className="section-title">🎴 現場</h3>
                </div>
                {playField.length === 0 ? (
                  <div style={{
                    padding: "1rem",
                    background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
                    borderRadius: "8px",
                    textAlign: "center",
                    color: "#1976d2",
                    fontSize: "0.9rem"
                  }}>
                    カードを出してください
                  </div>
                ) : (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(85px, 1fr))",
                    gap: "0.3rem",
                    padding: "0.75rem",
                    background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
                    borderRadius: "8px"
                  }}>
                    {playField.map((card, idx) => (
                      <div
                        key={`field-${card.id}-${idx}`}
                        onClick={() => openCardMenu(card, idx, "field")}
                        style={{
                          borderRadius: "8px",
                          overflow: "hidden",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                          transition: "transform 0.2s",
                          cursor: "pointer"
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = "translateY(-8px)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        <div style={{ aspectRatio: "0.7", position: "relative" }}>
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
                              background: `linear-gradient(135deg, ${colorMap[card.color ?? "黄"]} 0%, ${colorMap[card.color ?? "黄"]}dd 100%)`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexDirection: "column",
                              color: "white",
                              padding: "0.25rem"
                            }}>
                              <div style={{ fontSize: "0.6rem", marginBottom: "0.1rem" }}>
                                Lv.{card.level}
                              </div>
                              <div style={{ fontSize: "0.7rem", fontWeight: "bold", textAlign: "center", lineHeight: "1.1" }}>
                                {card.name}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 手札表示 */}
              <div className="section-header">
                <h3 className="section-title">🃏 手札</h3>
              </div>
              {playHand.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🃏</div>
                  <div>手札がありません</div>
                </div>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(85px, 1fr))",
                  gap: "0.3rem",
                  padding: "0.5rem 0"
                }}>
                  {playHand.map((card, idx) => {
                    const isSelected = selectedForMulligan.includes(idx);
                    return (
                      <div
                        key={`hand-${card.id}-${idx}`}
                        onClick={() => isMulliganMode ? toggleMulliganSelect(idx) : openCardMenu(card, idx, "hand")}
                        style={{
                          borderRadius: "8px",
                          overflow: "hidden",
                          boxShadow: isSelected 
                            ? "0 0 0 4px #fbc02d, 0 4px 12px rgba(0,0,0,0.15)"
                            : "0 4px 12px rgba(0,0,0,0.15)",
                          transition: "transform 0.2s, box-shadow 0.2s",
                          cursor: "pointer",
                          position: "relative"
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = "translateY(-8px)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        <div style={{ aspectRatio: "0.7", position: "relative" }}>
                          {card.image ? (
                            <img
                              src={URL.createObjectURL(card.image)}
                              alt={card.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                opacity: isSelected ? 0.7 : 1
                              }}
                            />
                          ) : (
                            <div style={{
                              width: "100%",
                              height: "100%",
                              background: `linear-gradient(135deg, ${colorMap[card.color ?? "黄"]} 0%, ${colorMap[card.color ?? "黄"]}dd 100%)`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexDirection: "column",
                              color: "white",
                              padding: "0.25rem",
                              opacity: isSelected ? 0.7 : 1
                            }}>
                              <div style={{ fontSize: "0.6rem", marginBottom: "0.1rem" }}>
                                Lv.{card.level}
                              </div>
                              <div style={{ fontSize: "0.7rem", fontWeight: "bold", textAlign: "center", lineHeight: "1.1" }}>
                                {card.name}
                              </div>
                            </div>
                          )}
                          {isSelected && (
                            <div style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              background: "rgba(251, 192, 45, 0.95)",
                              color: "white",
                              borderRadius: "50%",
                              width: "50px",
                              height: "50px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.5rem",
                              fontWeight: "bold",
                              border: "3px solid white",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                            }}>
                              ✓
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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

      {/* カードメニューモーダル */}
      {showCardMenu && selectedCard && (
        <div 
          className="modal-overlay" 
          onClick={closeCardMenu}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "1.5rem",
              maxWidth: "90%",
              width: "400px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
            }}
          >
            {/* メニューボタン */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {selectedCard.location === "hand" && (
                <button
                  className="btn-primary"
                  onClick={() => handleMenuAction("play")}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    fontSize: "1.1rem"
                  }}
                >
                  🎴 現場に出す
                </button>
              )}
              
              {selectedCard.location === "field" && (
                <button
                  className="btn-primary"
                  onClick={() => handleMenuAction("remove")}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    fontSize: "1.1rem"
                  }}
                >
                  🗑️ リムーブエリアへ
                </button>
              )}
              
              <button
                className="btn-secondary"
                onClick={() => handleMenuAction("view")}
                style={{
                  width: "100%",
                  padding: "1rem",
                  fontSize: "1.1rem"
                }}
              >
                🔍 拡大表示
              </button>
              
              <button
                className="btn-secondary"
                onClick={closeCardMenu}
                style={{
                  width: "100%",
                  padding: "1rem",
                  fontSize: "1.1rem"
                }}
              >
                ❌ キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* カード拡大表示モーダル */}
      {showCardDetail && detailCard && (
        <div 
          className="modal-overlay" 
          onClick={closeCardDetail}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "1.5rem",
              maxWidth: "350px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative"
            }}
          >
            {/* 閉じるボタン（右上） */}
            <button
              onClick={closeCardDetail}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "2px solid #e0e0e0",
                background: "white",
                fontSize: "1.2rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
                zIndex: 10,
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#f5f5f5";
                e.currentTarget.style.borderColor = "#999";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.borderColor = "#e0e0e0";
              }}
            >
              ✕
            </button>

            {/* カード画像 */}
            <div style={{
              marginBottom: "1rem",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              maxWidth: "200px",
              margin: "0 auto 1rem auto"
            }}>
              {detailCard.image ? (
                <img
                  src={URL.createObjectURL(detailCard.image)}
                  alt={detailCard.name}
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block"
                  }}
                />
              ) : (
                <div style={{
                  aspectRatio: "0.7",
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
            </div>

            {/* カード情報 */}
            <div style={{ marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.75rem", color: "#333" }}>
                {detailCard.name}
              </h2>
              
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                {detailCard.number && (
                  <span style={{
                    padding: "0.25rem 0.75rem",
                    background: "#e0e0e0",
                    borderRadius: "12px",
                    fontSize: "0.9rem",
                    fontWeight: "bold"
                  }}>
                    No.{detailCard.number}
                  </span>
                )}
                {detailCard.color && (
                  <span style={{
                    padding: "0.25rem 0.75rem",
                    background: colorMap[detailCard.color],
                    color: "white",
                    borderRadius: "12px",
                    fontSize: "0.9rem",
                    fontWeight: "bold"
                  }}>
                    {detailCard.color}
                  </span>
                )}
                {detailCard.type && (
                  <span style={{
                    padding: "0.25rem 0.75rem",
                    background: "#667eea",
                    color: "white",
                    borderRadius: "12px",
                    fontSize: "0.9rem",
                    fontWeight: "bold"
                  }}>
                    {detailCard.type}
                  </span>
                )}
                {detailCard.level && (
                  <span style={{
                    padding: "0.25rem 0.75rem",
                    background: "#f093fb",
                    color: "white",
                    borderRadius: "12px",
                    fontSize: "0.9rem",
                    fontWeight: "bold"
                  }}>
                    Lv.{detailCard.level}
                  </span>
                )}
              </div>

              {detailCard.memo && (
                <div style={{
                  padding: "0.75rem",
                  background: "#f5f7fa",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  color: "#666",
                  whiteSpace: "pre-wrap"
                }}>
                  {detailCard.memo}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
