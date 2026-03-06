import { useEffect, useMemo, useState } from "react";
import { db, fullSync, syncFromSupabase, syncToSupabase } from "./db";
import type { Card, Deck, DeckCard } from "./db";
import "./App.css";
import cardBackImage from "/card-back.png";
import { CsvImportModal } from "./components/CsvImportModal";
import { CardList } from "./components/CardList";
import { DeckManager } from "./components/DeckManager";
import { DeckEditor } from "./components/DeckEditor";
import { PlayScreen } from "./components/PlayScreen";
import Thumb from "./shared/Thumb";
import { colorMap, COLOR_OPTIONS, TYPE_OPTIONS, LEVEL_OPTIONS, TARGET_DECK_SIZE, SAME_NAME_LIMIT } from "./shared/constants";
import { CardEditModal } from "./components/modals/CardEditModal";
import { DeckCardEditModal } from "./components/modals/DeckCardEditModal"; 
import { CardDetailModal } from "./components/modals/CardDetailModal";

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
  
  // カード選択（一括削除用）
  const [selectedCardIds, setSelectedCardIds] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  const [form, setForm] = useState<Partial<Card>>({ 
    name: "", 
    number: "",  // 空文字列から開始（必須）
    color: "黄",
    type: "キャラ",
    level: 1,
    traits: "",
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
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingImages, setExportingImages] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  
  // 編集用の状態
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editForm, setEditForm] = useState<Partial<Card>>({});
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  
  // デッキカード編集用
  const [editingDeckCard, setEditingDeckCard] = useState<{ cardId: number; count: number } | null>(null);

  // カード詳細表示用

  // カード選択モーダル用
  const [showCardSelectModal, setShowCardSelectModal] = useState(false);
  const [cardSelectFilter, setCardSelectFilter] = useState<"all" | "partner" | "incident">("all");
  const [cardSelectSearch, setCardSelectSearch] = useState("");
  const [cardSelectColor, setCardSelectColor] = useState("");
  const [cardSelectType, setCardSelectType] = useState("");
  const [cardSelectLevel, setCardSelectLevel] = useState("");

  // CSV取り込みモーダル用
  const [showCsvImport, setShowCsvImport] = useState(false);

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

      // imageBlob はメモリ節約のため除外（ThumbコンポーネントがcardIdで遅延取得する）
      const allCards = await db.cards.orderBy("updatedAt").reverse().toArray();
      setCards(allCards.map(c => ({ ...c, image: undefined })));

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
      const traits = (c.traits ?? "").toLowerCase();
      const memo = (c.memo ?? "").toLowerCase();
      const matchText = !q || name.includes(q) || num.includes(q) || traits.includes(q) || memo.includes(q);
      const matchColor = !filterColor || c.color === filterColor;
      const matchType = !filterType || c.type === filterType;
      const matchLevel = !filterLevel || String(c.level) === String(filterLevel);
      
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
    const hasFilter = q || cardSelectColor || cardSelectType || cardSelectLevel;
    const filtered = cards.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const num = (c.number ?? "").toLowerCase();
      const matchText = !q || name.includes(q) || num.includes(q) || (c.traits ?? "").toLowerCase().includes(q) || (c.memo ?? "").toLowerCase().includes(q);
      const matchColor = !cardSelectColor || c.color === cardSelectColor;
      const matchType = !cardSelectType || c.type === cardSelectType;
      const matchLevel = !cardSelectLevel || String(c.level) === String(cardSelectLevel);
      return matchText && matchColor && matchType && matchLevel;
    });
    return filtered.slice(0, 200); // 常に200件上限（スマホクラッシュ防止）
  }, [cards, cardSelectSearch, cardSelectColor, cardSelectType, cardSelectLevel]);

  async function refreshAll() {
    const allDecks = await db.decks.toArray();
    setDecks(allDecks);

    const allCards = await db.cards.orderBy("updatedAt").reverse().toArray();
    setCards(allCards.map(c => ({ ...c, image: undefined })));

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
      traits: card.traits,
      memo: card.memo,
    });
    setEditImageFile(null);
  }

  function closeEditCard() {
    setEditingCard(null);
    setEditForm({});
    setEditImageFile(null);
  }


  function openCardDetail(card: Card) {
    setDetailCard(card);
    setShowCardDetail(true);
  }

  function closeCardDetail() {
    setShowCardDetail(false);
    setDetailCard(null);
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
      level: editForm.level,
      traits: (editForm.traits ?? "").trim() || undefined,
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

  // 選択カードの切り替え
  function toggleCardSelection(cardId: number) {
    setSelectedCardIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  }

  // 全選択・全解除
  function toggleSelectAll() {
    if (selectedCardIds.size === filteredCards.length) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(filteredCards.map(c => c.id!).filter(id => id !== undefined)));
    }
  }

  // 選択カードを一括削除
  async function deleteSelectedCards() {
    if (selectedCardIds.size === 0) {
      alert("削除するカードを選択してください");
      return;
    }

    const ok = confirm(`選択した${selectedCardIds.size}枚のカードを削除しますか？（デッキからも消えます）`);
    if (!ok) return;

    for (const cardId of selectedCardIds) {
      await db.deckCards.where("cardId").equals(cardId).delete();
      await db.cards.delete(cardId);
    }

    setSelectedCardIds(new Set());
    setIsSelectionMode(false);
    await refreshAll();
  }

  // デッキからカードを外す（カード自体は削除しない）
  async function removeCardFromDeck(cardId: number) {
    if (activeDeckId == null) return;

    await db.deckCards
      .where("[deckId+cardId]")
      .equals([activeDeckId, cardId])
      .delete();

    await refreshAll();
    closeCardDetail();
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
      level: form.level,
      traits: (form.traits ?? "").trim() || undefined,
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
      level: 1,
      traits: "",
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

  // CSVエクスポート機能
  async function handleExportCSV() {
    try {
      setExportingCSV(true);
      const allCards = await db.cards.toArray();
      
      if (allCards.length === 0) {
        alert('エクスポートするカードがありません');
        return;
      }
      
      // ヘッダー行
      const headers = ['number', 'name', 'level', 'color', 'type', 'traits', 'memo', 'image'];
      
      // データ行を作成
      const rows = allCards.map(card => {
        // 画像ファイル名を生成
        let imageFileName = '';
        if (card.image) {
          const ext = card.image.type?.split('/')[1] || 'png';
          imageFileName = `${card.number || card.id}.${ext}`;
        }
        
        return [
          card.number || '',
          card.name || '',
          card.level?.toString() || '',
          card.color || '',
          card.type || '',
          card.traits || '',
          // memoにカンマや改行が含まれる場合はダブルクォートで囲む
          card.memo ? `"${card.memo.replace(/"/g, '""').replace(/\n/g, ' ')}"` : '',
          imageFileName
        ].join(',');
      });
      
      // CSV文字列を作成（BOM付きでExcel対応）
      const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
      
      // ダウンロード
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cards_backup_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      alert(`✅ ${allCards.length}件のカードをエクスポートしました`);
    } catch (error) {
      console.error('CSVエクスポートエラー:', error);
      alert('❌ CSVエクスポートに失敗しました');
    } finally {
      setExportingCSV(false);
    }
  }

  // 画像一括ダウンロード機能
  async function handleExportImages() {
    try {
      const allCards = await db.cards.toArray();
      const cardsWithImages = allCards.filter(card => card.image);
      
      if (cardsWithImages.length === 0) {
        alert('ダウンロードする画像がありません');
        return;
      }
      
      setExportingImages(true);
      setSyncMessage('🖼️ 画像を準備中...');
      
      // JSZipを動的にインポート
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      // 各カードの画像をZIPに追加
      for (let i = 0; i < cardsWithImages.length; i++) {
        const card = cardsWithImages[i];
        if (!card.image) continue;
        
        const ext = card.image.type?.split('/')[1] || 'png';
        const fileName = `${card.number || card.id}.${ext}`;
        
        // Blobをarraybufferに変換
        const arrayBuffer = await card.image.arrayBuffer();
        zip.file(fileName, arrayBuffer);
        
        setSyncMessage(`🖼️ 画像を準備中... ${i + 1}/${cardsWithImages.length}`);
      }
      
      setSyncMessage('📦 ZIPファイルを作成中...');
      
      // ZIPを生成してダウンロード
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `images_backup_${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      
      setExportingImages(false);
      setSyncMessage('');
      alert(`✅ ${cardsWithImages.length}件の画像をエクスポートしました`);
    } catch (error) {
      console.error('画像エクスポートエラー:', error);
      setExportingImages(false);
      setSyncMessage('');
      alert('❌ 画像エクスポートに失敗しました');
    }
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
    
    // タブ切り替え時に一番上にスクロール
    window.scrollTo(0, 0);
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
          <li><button className={`nav-tab-button ${activeTab === "play" ? "active" : ""}`} onClick={() => switchTab("play")}>一人回し</button></li>
          <li><button className={`nav-tab-button ${activeTab === "sync" ? "active" : ""}`} onClick={() => switchTab("sync")}>同期</button></li>
        </ul>
      </nav>

   <CardEditModal
  editingCard={editingCard}
  editForm={editForm}
  setEditForm={setEditForm}
  editImageFile={editImageFile}
  setEditImageFile={setEditImageFile}
  onClose={closeEditCard}
  onSave={saveEditCard}
/>

      {/* デッキカード枚数編集モーダル */}
<DeckCardEditModal
  editingDeckCard={editingDeckCard}
  cards={cards}
  onIncrement={incrementDeckCard}
  onDecrement={decrementDeckCard}
  onClose={closeEditDeckCard}
/>

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
              <div className="search-bar" style={{ marginBottom: "0.75rem", position: "relative" }}>
                <input 
                  type="text" 
                  placeholder="🔍 カード名・番号で検索..." 
                  value={cardSelectSearch} 
                  onChange={(e) => setCardSelectSearch(e.target.value)} 
                  style={{ paddingRight: cardSelectSearch ? "2.5rem" : "0.75rem" }}
                />
                {cardSelectSearch && (
                  <button
                    onClick={() => setCardSelectSearch("")}
                    style={{
                      position: "absolute",
                      right: "0.5rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "1.5rem",
                      height: "1.5rem",
                      borderRadius: "50%",
                      border: "none",
                      background: "#e0e0e0",
                      color: "#666",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1rem",
                      padding: 0,
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = "#ccc"}
                    onMouseOut={(e) => e.currentTarget.style.background = "#e0e0e0"}
                  >
                    ✕
                  </button>
                )}
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
            <div style={{ fontSize: "0.8rem", color: "#999", marginBottom: "0.5rem", textAlign: "right" }}>
              {filteredCardsForModal.length}件表示
              {filteredCardsForModal.length >= 200 && <span style={{ color: "#ff8ab8" }}>（上限200件・絞り込んで検索してください）</span>}
            </div>
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
                        <Thumb cardId={card.id} alt={card.name ?? "card"} size="small" />
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
          <CardList
            cards={cards}
            filteredCards={filteredCards}
            search={search}
            setSearch={setSearch}
            filterColor={filterColor}
            setFilterColor={setFilterColor}
            filterType={filterType}
            setFilterType={setFilterType}
            filterLevel={filterLevel}
            setFilterLevel={setFilterLevel}
            showCardForm={showCardForm}
            setShowCardForm={setShowCardForm}
            form={form}
            setForm={setForm}
            imageFile={imageFile}
            setImageFile={setImageFile}
            isSelectionMode={isSelectionMode}
            setIsSelectionMode={setIsSelectionMode}
            selectedCardIds={selectedCardIds}
            saveCard={saveCard}
            deleteCard={deleteCard}
            addCardToDeck={addCardToDeck}
            openEditCard={openEditCard}
            openCardDetail={openCardDetail}
            toggleCardSelection={toggleCardSelection}
            toggleSelectAll={toggleSelectAll}
            deleteSelectedCards={deleteSelectedCards}
            setShowCsvImport={setShowCsvImport}
          />
        </div>

        <div className={`screen ${activeTab === "decks" ? "active" : ""}`}>
          <DeckManager
            decks={decks}
            activeDeckId={activeDeckId}
            cards={cards}
            deckCards={deckCards}
            createDeck={createDeck}
            renameDeck={renameDeck}
            deleteDeck={deleteDeck}
            setActiveDeckId={setActiveDeckId}
            switchTab={switchTab}
          />
        </div>

        <div className={`screen ${activeTab === "editor" ? "active" : ""}`}>
          <DeckEditor
            activeDeck={activeDeck}
            totalInDeck={totalInDeck}
            partnerCard={partnerCard}
            incidentCard={incidentCard}
            characterCount={characterCount}
            eventCount={eventCount}
            levelDistribution={levelDistribution}
            maxLevelCount={maxLevelCount}
            cardsByLevel={cardsByLevel}
            deckCards={deckCards}
            cards={cards}
            deckCardMap={deckCardMap}
            openCardDetail={openCardDetail}
            openCardSelectModal={openCardSelectModal}
            openEditDeckCard={openEditDeckCard}
            removeCardFromDeck={removeCardFromDeck}
            createDeck={createDeck}
            renameDeck={renameDeck}
          />
        </div>

        {/* 一人回し画面 */}
        <div className={`screen ${activeTab === "play" ? "active" : ""}`}>
          <PlayScreen
            decks={decks}
            cards={cards}
            createDeck={createDeck}
          />
        </div>

        <div className={`screen ${activeTab === "sync" ? "active" : ""}`}>
          <div style={{ marginTop: "-1.5rem" }}>
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

          {/* バックアップセクション */}
          <div className="section" style={{ marginTop: "1.5rem" }}>
            <div className="section-header">
              <h2 className="section-title">📥 バックアップ</h2>
            </div>
            <div className="info-panel" style={{ marginBottom: "1rem" }}>
              <div className="info-panel-text">
                アプリ内のデータをダウンロードして、PCに保存できます。
              </div>
            </div>
            <div className="form-grid">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <button 
                  className="btn-secondary" 
                  onClick={handleExportCSV} 
                  disabled={exportingCSV || exportingImages}
                  style={{ padding: "1rem" }}
                >
                  {exportingCSV ? "⏳ エクスポート中..." : "📄 CSVエクスポート"}
                </button>
                <button 
                  className="btn-secondary" 
                  onClick={handleExportImages} 
                  disabled={exportingCSV || exportingImages}
                  style={{ padding: "1rem" }}
                >
                  {exportingImages ? "⏳ 準備中..." : "🖼️ 画像ダウンロード"}
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>


      {/* カード詳細モーダル */}
      <CardDetailModal
        show={showCardDetail}
        card={detailCard}
        showRemoveButton={true}
        onRemove={removeCardFromDeck}
        onClose={closeCardDetail}
      />

            <CsvImportModal 
        show={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        onComplete={refreshAll}
      />
    </div>
  );
}
