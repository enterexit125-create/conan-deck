import { useState } from "react";
import { db } from "../db";
import type { Card, Deck } from "../db";
import { TARGET_DECK_SIZE } from "../shared/constants";
import { DeckSelectScreen } from "./play/DeckSelectScreen";
import { VersusPlayField } from "./play/VersusPlayField";
import { MulliganModal } from "./play/modals/MulliganModal";
import { CardMenuModal } from "./play/modals/CardMenuModal";
import { CardDetailModal } from "./play/modals/CardDetailModal";
import { MoveDestinationModal } from "./play/modals/MoveDestinationModal";
import { SetTargetModal } from "./play/modals/SetTargetModal";
import Thumb from "../shared/Thumb";

// マリガン用の小さいカードサムネイル
function MulliganCardThumb({ card }: { card: Card }) {
  const [src, setSrc] = useState<string>("");
  
  useState(() => {
    if (card.image) {
      const url = URL.createObjectURL(card.image);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
  });

  if (!src && card.image) {
    const url = URL.createObjectURL(card.image);
    setSrc(url);
  }

  return (
    <div style={{
      width: "85px",
      height: "119px",
      borderRadius: "3px",
      overflow: "hidden",
      border: "1px solid #ccc",
      background: "#f0f0f0"
    }}>
      {src ? (
        <img
          src={src}
          alt={card.name ?? "card"}
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.6rem",
          color: "#999"
        }}>
          No Image
        </div>
      )}
    </div>
  );
}

interface PlayScreenProps {
  decks: Deck[];
  cards: Card[];
  createDeck: () => Promise<void>;
}

// プレイヤーごとの状態を管理する型
interface PlayerState {
  deckId: number;
  deck: Card[];
  hand: Card[];
  field: Card[];
  remove: Card[];
  evidence: Card[];
  file: Card[];
  partnerZone: Card[];
  evidenceFaceUp: Set<number | undefined>;
  mulliganDone: boolean;
  partnerState: "normal" | "reasoning" | "assist";
  traceFound: boolean;
  partnerCard: Card | null;   // デッキに設定されたパートナー
  incidentCard: Card | null;  // デッキに設定された事件
}

export function PlayScreen({ decks, cards, createDeck }: PlayScreenProps) {
  // ゲーム状態
  const [isPlaying, setIsPlaying] = useState(false);
  const [turnPlayer, setTurnPlayer] = useState<1 | 2>(1);    // 実際の手番プレイヤー
  const [viewingPlayer, setViewingPlayer] = useState<1 | 2>(1); // 現在画面に表示中のプレイヤー
  const currentPlayer = viewingPlayer; // 表示・操作対象（後方互換用）
  
  // プレイヤー1の状態
  const [player1, setPlayer1] = useState<PlayerState | null>(null);
  
  // プレイヤー2の状態
  const [player2, setPlayer2] = useState<PlayerState | null>(null);
  
  // 共通の状態
  const [isEvidenceCollapsed, setIsEvidenceCollapsed] = useState(false);
  const [isMulliganMode, setIsMulliganMode] = useState(false);
  const [selectedForMulligan, setSelectedForMulligan] = useState<number[]>([]);
  const [newMulliganCardIndices, setNewMulliganCardIndices] = useState<number[]>([]); // マリガンで新しく来たカードのインデックス
  const [newHandCardIndices, setNewHandCardIndices] = useState<number[]>([]); // 今ターンで手札に追加されたカードのインデックス
  const [newFieldCardIndices, setNewFieldCardIndices] = useState<number[]>([]); // 今ターンで現場に出たカードのインデックス
  const [turnEndTrigger, setTurnEndTrigger] = useState(0); // ターン終了トリガー
  
  // ログ機能
  const [gameLog, setGameLog] = useState<{time: string; player: 1 | 2 | null; message: string}[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [turnCount, setTurnCount] = useState(1); // ターン数
  
  // モーダル表示状態
  const [showCardMenu, setShowCardMenu] = useState(false);
  const [selectedCard, setSelectedCard] = useState<{ 
    card: Card; 
    index: number; 
    location: "hand" | "field" | "remove" | "evidence" | "file" | "partnerZone"
  } | null>(null);
  const [showMoveDestination, setShowMoveDestination] = useState(false);
  const [showRemoveMoveModal, setShowRemoveMoveModal] = useState(false); // リムーブからの移動モーダル
  const [showHandMoveModal, setShowHandMoveModal] = useState(false); // 手札からの移動モーダル
  const [showPartnerZoneMoveModal, setShowPartnerZoneMoveModal] = useState(false); // パートナーゾーンからの移動モーダル
  const [showPartnerCardModal, setShowPartnerCardModal] = useState(false); // パートナーカードモーダル
  const [showCardDetail, setShowCardDetail] = useState(false);
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  
  // セットカード選択モーダル
  const [showSetTargetModal, setShowSetTargetModal] = useState(false);
  
  // セットカード追加用のpending state
  const [pendingSetCard, setPendingSetCard] = useState<{
    card: Card;
    fieldIndex: number;
    player: 1 | 2;
  } | null>(null);

  // セットカード削除要求用のstate
  const [removeSetCardsRequest, setRemoveSetCardsRequest] = useState<{
    fieldIndex: number;
    player: 1 | 2;
  } | null>(null);

  // 現在のプレイヤーの状態を取得
  const currentPlayerState = currentPlayer === 1 ? player1 : player2;
  const opponentPlayerState = currentPlayer === 1 ? player2 : player1;

  // パートナーと事件カードは現在表示中プレイヤーのデッキから取得
  const partnerCard = currentPlayerState?.partnerCard ?? null;
  const incidentCard = currentPlayerState?.incidentCard ?? null;

  // プレイヤーの状態を更新
  function updatePlayerState(playerNum: 1 | 2, updates: Partial<PlayerState>) {
    if (playerNum === 1) {
      setPlayer1(prev => prev ? { ...prev, ...updates } : null);
    } else {
      setPlayer2(prev => prev ? { ...prev, ...updates } : null);
    }
  }

  // ログを追加
  function addLog(message: string, player: 1 | 2 | null = turnPlayer) {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setGameLog(prev => [...prev, { time, player, message }]);
  }

  // ゲーム開始
  async function startPlay(player1DeckId: number, player2DeckId: number) {
    // プレイヤー1のデッキを初期化（先攻）
    const p1State = await initializeDeck(player1DeckId, true);
    if (!p1State) return;
    
    // プレイヤー2のデッキを初期化（後攻）
    const p2State = await initializeDeck(player2DeckId, false);
    if (!p2State) return;

    setPlayer1(p1State);
    setPlayer2(p2State);
    setTurnPlayer(1);
    setViewingPlayer(1);
    setIsPlaying(true);
    setGameLog([]);
    setTurnCount(1);
    // ゲーム開始後にログを追加
    setTimeout(() => {
      addLog("ゲーム開始", null);
      addLog("ターン1 開始", null);
    }, 0);
  }

  // デッキを初期化してPlayerStateを返す
  async function initializeDeck(deckId: number, isFirstPlayer: boolean): Promise<PlayerState | null> {
    const dcs = await db.deckCards.where("deckId").equals(deckId).toArray();
    
    let deckPartnerCard: Card | null = null;
    let deckIncidentCard: Card | null = null;
    const allPlayCards: Card[] = [];
    for (const dc of dcs) {
      const card = await db.cards.get(dc.cardId);
      if (!card) continue;
      if (card.type === "パートナー") {
        deckPartnerCard = card;
      } else if (card.type === "事件") {
        deckIncidentCard = card;
      } else {
        for (let i = 0; i < dc.count; i++) {
          allPlayCards.push(card);
        }
      }
    }

    if (allPlayCards.length !== TARGET_DECK_SIZE) {
      alert(`デッキが40枚ではありません（現在${allPlayCards.length}枚）`);
      return null;
    }

    // シャッフル
    const shuffled = [...allPlayCards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 初期配置（先攻のみFILE1枚）
    const hand = shuffled.slice(0, 5);
    const fileCard = isFirstPlayer ? shuffled.slice(5, 6) : [];
    const deck = isFirstPlayer ? shuffled.slice(6) : shuffled.slice(5);

    return {
      deckId,
      deck,
      hand,
      file: fileCard,
      field: [],
      remove: [],
      evidence: [],
      partnerZone: [],
      evidenceFaceUp: new Set(),
      mulliganDone: false,
      partnerState: "normal" as const,
      traceFound: false,
      partnerCard: deckPartnerCard,
      incidentCard: deckIncidentCard,
    };
  }

  // カードドロー
  function drawCard() {
    if (!currentPlayerState) return;
    
    // 山札が0枚の場合はドローできない
    if (currentPlayerState.deck.length === 0) {
      alert("山札がありません。リフレッシュしてください。");
      return;
    }

    const newCard = currentPlayerState.deck[0];
    const newDeck = currentPlayerState.deck.slice(1);
    const newIndex = currentPlayerState.hand.length; // 新しいカードのインデックス
    
    updatePlayerState(currentPlayer, {
      hand: [...currentPlayerState.hand, newCard],
      deck: newDeck
    });
    
    // 新しい手札カードのインデックスを追加
    setNewHandCardIndices(prev => [...prev, newIndex]);
    addLog("ドローした");
  }

  // リフレッシュ処理（山札0枚時にリムーブを山札に戻す）
  function refreshDeck() {
    if (!currentPlayerState) return;
    
    if (currentPlayerState.deck.length > 0) {
      alert("山札がまだあります。");
      return;
    }
    
    if (currentPlayerState.remove.length === 0) {
      alert("リムーブエリアにもカードがありません！");
      return;
    }
    
    // リムーブエリアのカードをシャッフルして山札に
    const shuffled = [...currentPlayerState.remove];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    updatePlayerState(currentPlayer, {
      deck: shuffled,
      remove: []
    });
    
    // 相手に証拠を1枚追加（相手の山札から）
    const opponent = currentPlayer === 1 ? 2 : 1;
    const opponentState = currentPlayer === 1 ? player2 : player1;
    if (opponentState && opponentState.deck.length > 0) {
      const evidenceCard = opponentState.deck[0];
      const newOpponentDeck = opponentState.deck.slice(1);
      updatePlayerState(opponent, {
        deck: newOpponentDeck,
        evidence: [...opponentState.evidence, evidenceCard],
        traceFound: true  // 痕跡発見済みフラグ
      });
    }
    
    addLog("リフレッシュ（リムーブ→山札）");
    addLog("相手に証拠+1", currentPlayer === 1 ? 2 : 1);
    alert("リフレッシュ！リムーブを山札に戻しました。相手に証拠が1枚追加されました。");
  }

  // 手番開始
  function startTurn() {
    if (!currentPlayerState || currentPlayerState.deck.length < 2) {
      alert("山札のカードが足りません（2枚必要）");
      return;
    }
    
    const newFileCards = currentPlayerState.deck.slice(0, 2);
    const remainingDeck = currentPlayerState.deck.slice(2);
    
    updatePlayerState(currentPlayer, {
      deck: remainingDeck,
      file: [...currentPlayerState.file, ...newFileCards]
    });
  }

  // 手札から現場に出す
  function playCardToField(index: number) {
    if (!currentPlayerState || isMulliganMode) return;
    
    const card = currentPlayerState.hand[index];
    const newHand = currentPlayerState.hand.filter((_, i) => i !== index);
    const newFieldIndex = currentPlayerState.field.length; // 新しいカードのインデックス
    
    updatePlayerState(currentPlayer, {
      hand: newHand,
      field: [...currentPlayerState.field, card]
    });
    
    // 新しい現場カードのインデックスを追加
    setNewFieldCardIndices(prev => [...prev, newFieldIndex]);
    
    // 手札から消えたので、手札の新カードインデックスを更新
    setNewHandCardIndices(prev => 
      prev.filter(i => i !== index).map(i => i > index ? i - 1 : i)
    );
    setNewMulliganCardIndices(prev => 
      prev.filter(i => i !== index).map(i => i > index ? i - 1 : i)
    );
    
    addLog(`「${card.name}」を現場に出した`);
    setShowCardMenu(false);
  }

  // 現場からの移動
  function moveFieldCard(fromIndex: number, destination: "hand" | "remove" | "deckTop" | "deckBottom" | "partner") {
    if (!currentPlayerState) return;
    
    const card = currentPlayerState.field[fromIndex];
    const newField = currentPlayerState.field.filter((_, i) => i !== fromIndex);
    
    // セットカードの削除を要求
    setRemoveSetCardsRequest({ fieldIndex: fromIndex, player: currentPlayer });
    
    const updates: Partial<PlayerState> = {
      field: newField
    };
    
    switch (destination) {
      case "hand":
        updates.hand = [...currentPlayerState.hand, card];
        // 新しい手札カードとしてハイライト
        setNewHandCardIndices(prev => [...prev, currentPlayerState.hand.length]);
        break;
      case "remove":
        updates.remove = [...currentPlayerState.remove, card];
        break;
      case "deckTop":
        // 山札の一番上に追加
        updates.deck = [card, ...currentPlayerState.deck];
        break;
      case "deckBottom":
        // 山札の一番下に追加
        updates.deck = [...currentPlayerState.deck, card];
        break;
      case "partner":
        // パートナーゾーンへ
        updates.partnerZone = [...currentPlayerState.partnerZone, card];
        break;
    }
    
    // 現場のハイライトインデックスを更新
    setNewFieldCardIndices(prev => 
      prev.filter(i => i !== fromIndex).map(i => i > fromIndex ? i - 1 : i)
    );
    
    updatePlayerState(currentPlayer, updates);
    setShowCardMenu(false);
  }

  // パートナーゾーンからの移動
  function movePartnerZoneCard(fromIndex: number, destination: "field" | "remove") {
    if (!currentPlayerState) return;
    
    const card = currentPlayerState.partnerZone[fromIndex];
    const newPartnerZone = currentPlayerState.partnerZone.filter((_, i) => i !== fromIndex);
    
    const updates: Partial<PlayerState> = {
      partnerZone: newPartnerZone
    };
    
    switch (destination) {
      case "field":
        updates.field = [...currentPlayerState.field, card];
        // 新しい現場カードとしてハイライト
        setNewFieldCardIndices(prev => [...prev, currentPlayerState.field.length]);
        break;
      case "remove":
        updates.remove = [...currentPlayerState.remove, card];
        break;
    }
    
    updatePlayerState(currentPlayer, updates);
    setShowPartnerZoneMoveModal(false);
    setSelectedCard(null);
  }

  // 現場からリムーブへ
  function moveCardToRemove(index: number) {
    if (!currentPlayerState) return;
    
    const card = currentPlayerState.field[index];
    const newField = currentPlayerState.field.filter((_, i) => i !== index);
    
    // セットカードの削除を要求（VersusPlayFieldで処理される）
    setRemoveSetCardsRequest({ fieldIndex: index, player: currentPlayer });
    
    updatePlayerState(currentPlayer, {
      field: newField,
      remove: [...currentPlayerState.remove, card]
    });
    setShowCardMenu(false);
  }

  // 現場から証拠へ
  function moveCardToEvidence(index: number) {
    if (!currentPlayerState) return;
    
    const card = currentPlayerState.field[index];
    const newField = currentPlayerState.field.filter((_, i) => i !== index);
    
    // セットカードの削除を要求（VersusPlayFieldで処理される）
    setRemoveSetCardsRequest({ fieldIndex: index, player: currentPlayer });
    
    updatePlayerState(currentPlayer, {
      field: newField,
      evidence: [...currentPlayerState.evidence, card]
    });
    setShowCardMenu(false);
  }

  // 証拠カードの表裏切り替え
  function toggleEvidenceFaceUp(cardId: number | undefined) {
    if (!currentPlayerState) return;
    
    const newSet = new Set(currentPlayerState.evidenceFaceUp);
    if (newSet.has(cardId)) {
      newSet.delete(cardId);
    } else {
      newSet.add(cardId);
    }
    
    updatePlayerState(currentPlayer, {
      evidenceFaceUp: newSet
    });
  }

  // リムーブエリアからの移動
  function moveRemoveCard(fromIndex: number, destination: "hand" | "field" | "deck") {
    if (!currentPlayerState) return;
    
    const card = currentPlayerState.remove[fromIndex];
    const newRemove = currentPlayerState.remove.filter((_, i) => i !== fromIndex);
    
    const updates: Partial<PlayerState> = {
      remove: newRemove
    };
    
    switch (destination) {
      case "hand":
        updates.hand = [...currentPlayerState.hand, card];
        // 新しい手札カードとしてハイライト
        setNewHandCardIndices(prev => [...prev, currentPlayerState.hand.length]);
        break;
      case "field":
        updates.field = [...currentPlayerState.field, card];
        // 新しい現場カードとしてハイライト
        setNewFieldCardIndices(prev => [...prev, currentPlayerState.field.length]);
        break;
      case "deck":
        // 山札の一番下に追加
        updates.deck = [...currentPlayerState.deck, card];
        break;
    }
    
    updatePlayerState(currentPlayer, updates);
    setShowCardMenu(false);
    setShowRemoveMoveModal(false);
  }

  // 手札からの移動
  function moveHandCard(fromIndex: number, destination: "field" | "remove" | "deck") {
    if (!currentPlayerState) return;
    
    const card = currentPlayerState.hand[fromIndex];
    const newHand = currentPlayerState.hand.filter((_, i) => i !== fromIndex);
    
    const updates: Partial<PlayerState> = {
      hand: newHand
    };
    
    switch (destination) {
      case "field":
        updates.field = [...currentPlayerState.field, card];
        // 新しい現場カードとしてハイライト
        setNewFieldCardIndices(prev => [...prev, currentPlayerState.field.length]);
        break;
      case "remove":
        updates.remove = [...currentPlayerState.remove, card];
        break;
      case "deck":
        // 山札の一番下に追加
        updates.deck = [...currentPlayerState.deck, card];
        break;
    }
    
    // 手札のハイライトインデックスを更新
    setNewHandCardIndices(prev => 
      prev.filter(i => i !== fromIndex).map(i => i > fromIndex ? i - 1 : i)
    );
    setNewMulliganCardIndices(prev => 
      prev.filter(i => i !== fromIndex).map(i => i > fromIndex ? i - 1 : i)
    );
    
    updatePlayerState(currentPlayer, updates);
    setShowCardMenu(false);
    setShowHandMoveModal(false);
  }

  // 証拠エリアからの移動
  function moveEvidenceCard(fromIndex: number, destination: "hand" | "field" | "remove" | "deck") {
    if (!currentPlayerState) return;
    
    const card = currentPlayerState.evidence[fromIndex];
    const newEvidence = currentPlayerState.evidence.filter((_, i) => i !== fromIndex);
    
    const newFaceUp = new Set(currentPlayerState.evidenceFaceUp);
    newFaceUp.delete(card.id);
    
    const updates: Partial<PlayerState> = {
      evidence: newEvidence,
      evidenceFaceUp: newFaceUp
    };
    
    switch (destination) {
      case "hand":
        updates.hand = [...currentPlayerState.hand, card];
        break;
      case "field":
        updates.field = [...currentPlayerState.field, card];
        break;
      case "remove":
        updates.remove = [...currentPlayerState.remove, card];
        break;
      case "deck":
        updates.deck = [...currentPlayerState.deck, card];
        break;
    }
    
    updatePlayerState(currentPlayer, updates);
    setShowCardMenu(false);
    setShowMoveDestination(false);
  }

  // FILEエリアからの移動
  function moveFileCard(fromIndex: number, destination: "hand" | "field" | "remove" | "deck") {
    if (!currentPlayerState) return;
    
    const card = currentPlayerState.file[fromIndex];
    const newFile = currentPlayerState.file.filter((_, i) => i !== fromIndex);
    
    const updates: Partial<PlayerState> = {
      file: newFile
    };
    
    switch (destination) {
      case "hand":
        updates.hand = [...currentPlayerState.hand, card];
        break;
      case "field":
        updates.field = [...currentPlayerState.field, card];
        break;
      case "remove":
        updates.remove = [...currentPlayerState.remove, card];
        break;
      case "deck":
        updates.deck = [...currentPlayerState.deck, card];
        break;
    }
    
    updatePlayerState(currentPlayer, updates);
    setShowCardMenu(false);
    setShowMoveDestination(false);
  }

  // カードメニューを開く
  function openCardMenu(card: Card, index: number, location: "hand" | "field" | "remove" | "evidence" | "file" | "partnerZone") {
    setSelectedCard({ card, index, location });
    if (location === "partnerZone") {
      // パートナーゾーンの場合は直接移動モーダルを表示
      setShowPartnerZoneMoveModal(true);
    } else {
      setShowCardMenu(true);
    }
  }

  // カードメニューアクション
  function handleMenuAction(action: "play" | "remove" | "evidence" | "view" | "toggleFace" | "move" | "setToField" | "toHand" | "toDeckTop" | "toDeckBottom" | "toPartner") {
    if (!selectedCard) return;

    switch (action) {
      case "play":
        if (selectedCard.location === "hand") {
          playCardToField(selectedCard.index);
        }
        break;
      case "setToField":
        // セット先選択モーダルを開く
        if (selectedCard.location === "hand") {
          setShowCardMenu(false);
          setShowSetTargetModal(true);
        }
        break;
      case "remove":
        if (selectedCard.location === "field") {
          moveFieldCard(selectedCard.index, "remove");
        }
        break;
      case "evidence":
        if (selectedCard.location === "field") {
          moveCardToEvidence(selectedCard.index);
        }
        break;
      case "toHand":
        if (selectedCard.location === "field") {
          moveFieldCard(selectedCard.index, "hand");
        }
        break;
      case "toDeckTop":
        if (selectedCard.location === "field") {
          moveFieldCard(selectedCard.index, "deckTop");
        }
        break;
      case "toDeckBottom":
        if (selectedCard.location === "field") {
          moveFieldCard(selectedCard.index, "deckBottom");
        }
        break;
      case "toPartner":
        if (selectedCard.location === "field") {
          moveFieldCard(selectedCard.index, "partner");
        }
        break;
      case "toggleFace":
        if (selectedCard.location === "evidence") {
          toggleEvidenceFaceUp(selectedCard.card.id);
          setShowCardMenu(false);
        }
        break;
      case "move":
        if (selectedCard.location === "remove") {
          setShowRemoveMoveModal(true);
        } else if (selectedCard.location === "hand") {
          setShowHandMoveModal(true);
        } else {
          setShowMoveDestination(true);
        }
        break;
      case "view":
        setDetailCard(selectedCard.card);
        setShowCardDetail(true);
        setShowCardMenu(false);
        break;
    }
  }

  // カード詳細を開く
  function openCardDetail(card: Card) {
    setDetailCard(card);
    setShowCardDetail(true);
  }

  // パートナーカードをタップ
  function openPartnerCardModal(card: Card) {
    setDetailCard(card);
    setShowPartnerCardModal(true);
  }

  // パートナーの状態を変更
  function setPartnerState(state: "normal" | "reasoning" | "assist") {
    const prevState = currentPlayerState?.partnerState;

    if (state === "reasoning" && prevState !== "reasoning" && currentPlayerState) {
      // 推理開始：山札から証拠に追加（山札0枚ならまずリフレッシュ）
      let deckToUse = currentPlayerState.deck;
      let removeToUse = currentPlayerState.remove;
      let didRefresh = false;

      if (deckToUse.length === 0) {
        if (removeToUse.length === 0) {
          // 山札もリムーブもない場合はステート変更のみ
          updatePlayerState(currentPlayer, { partnerState: state });
          addLog("パートナーが推理中（山札・リムーブなし）");
          setShowPartnerCardModal(false);
          return;
        }
        // リフレッシュ：リムーブをシャッフルして山札に
        const shuffled = [...removeToUse];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        deckToUse = shuffled;
        removeToUse = [];
        didRefresh = true;

        // リフレッシュのペナルティ：相手に証拠+1
        const opponent = currentPlayer === 1 ? 2 : 1;
        const opponentState = currentPlayer === 1 ? player2 : player1;
        if (opponentState && opponentState.deck.length > 0) {
          const penaltyCard = opponentState.deck[0];
          updatePlayerState(opponent, {
            deck: opponentState.deck.slice(1),
            evidence: [...opponentState.evidence, penaltyCard],
            traceFound: true
          });
          addLog("リフレッシュ発生 → 相手に証拠+1", currentPlayer === 1 ? 2 : 1);
        }
        addLog("リフレッシュ（リムーブ→山札）");
      }

      // 山札トップを証拠に追加
      const evidenceCard = deckToUse[0];
      const newDeck = deckToUse.slice(1);
      updatePlayerState(currentPlayer, {
        partnerState: state,
        deck: newDeck,
        remove: removeToUse,
        evidence: [...currentPlayerState.evidence, evidenceCard],
        traceFound: true
      });
      addLog(didRefresh
        ? "パートナーが推理中 → リフレッシュ後に証拠+1"
        : "パートナーが推理中 → 証拠+1"
      );

    } else if (state === "normal" && prevState === "reasoning" && currentPlayerState) {
      // 推理解除：証拠の末尾を山札トップに戻す
      if (currentPlayerState.evidence.length > 0) {
        const lastEvidence = currentPlayerState.evidence[currentPlayerState.evidence.length - 1];
        const newEvidence = currentPlayerState.evidence.slice(0, -1);
        updatePlayerState(currentPlayer, {
          partnerState: state,
          deck: [lastEvidence, ...currentPlayerState.deck],
          evidence: newEvidence
        });
        addLog("パートナーの推理を解除 → 証拠-1（山札に戻す）");
      } else {
        updatePlayerState(currentPlayer, { partnerState: state });
        addLog("パートナーの推理を解除");
      }
    } else {
      updatePlayerState(currentPlayer, { partnerState: state });
    }

    setShowPartnerCardModal(false);
  }

  // マリガン開始
  function startMulligan() {
    setIsMulliganMode(true);
    setSelectedForMulligan([]);
  }

  // マリガンをスキップ
  function skipMulligan() {
    updatePlayerState(currentPlayer, { mulliganDone: true });
  }

  // マリガンカード選択
  function toggleMulliganSelect(index: number) {
    if (selectedForMulligan.includes(index)) {
      setSelectedForMulligan(selectedForMulligan.filter(i => i !== index));
    } else {
      if (selectedForMulligan.length < 5) {
        setSelectedForMulligan([...selectedForMulligan, index]);
      }
    }
  }

  // マリガンキャンセル
  function cancelMulligan() {
    setIsMulliganMode(false);
    setSelectedForMulligan([]);
    updatePlayerState(currentPlayer, { mulliganDone: true });
  }

  // マリガン実行
  function executeMulligan() {
    if (!currentPlayerState || selectedForMulligan.length === 0) {
      alert("マリガンするカードを選択してください");
      return;
    }

    const cardsToReturn = selectedForMulligan.map(i => currentPlayerState.hand[i]);
    const remainingHand = currentPlayerState.hand.filter((_, i) => !selectedForMulligan.includes(i));

    const newDeck = [...currentPlayerState.deck, ...cardsToReturn];
    
    // シャッフル
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }

    const drawCount = selectedForMulligan.length;
    const drawnCards = newDeck.slice(0, drawCount);
    const finalDeck = newDeck.slice(drawCount);

    // 新しく来たカードのインデックスを記録（残った手札の後に追加されるため）
    const newIndices = drawnCards.map((_, i) => remainingHand.length + i);
    setNewMulliganCardIndices(newIndices);

    updatePlayerState(currentPlayer, {
      hand: [...remainingHand, ...drawnCards],
      deck: finalDeck,
      mulliganDone: true
    });
    
    addLog(`マリガン ${drawCount}枚`);
    setIsMulliganMode(false);
    setSelectedForMulligan([]);
  }

  // ターン切り替え（上下逆転）- ハイライトは消さない
  function switchPlayer() {
    setViewingPlayer(viewingPlayer === 1 ? 2 : 1);
  }

  // ターン終了（相手のターンへ）
  function endTurn() {
    const nextTurnPlayer: 1 | 2 = turnPlayer === 1 ? 2 : 1;
    const nextPlayerState = nextTurnPlayer === 1 ? player1 : player2;
    const currentTurnPlayerState = turnPlayer === 1 ? player1 : player2;

    if (!currentTurnPlayerState) return;

    // 手番プレイヤーのパートナーを縦に戻す
    updatePlayerState(turnPlayer, { partnerState: "normal" });

    // 次の手番プレイヤーのFILEに2枚追加（次プレイヤーの山札から）
    if (nextPlayerState) {
      if (nextPlayerState.deck.length >= 2) {
        const newFileCards = nextPlayerState.deck.slice(0, 2);
        const remainingDeck = nextPlayerState.deck.slice(2);
        updatePlayerState(nextTurnPlayer, {
          file: [...nextPlayerState.file, ...newFileCards],
          deck: remainingDeck,
        });
      } else if (nextPlayerState.deck.length === 1) {
        const newFileCards = nextPlayerState.deck.slice(0, 1);
        updatePlayerState(nextTurnPlayer, {
          file: [...nextPlayerState.file, ...newFileCards],
          deck: [],
        });
      }
    }

    // ターン終了時に新カードハイライトをリセット
    setNewHandCardIndices([]);
    setNewFieldCardIndices([]);
    setNewMulliganCardIndices([]);

    addLog("ターン終了", turnPlayer);

    // 手番と表示を次のプレイヤーへ切り替え
    setTurnPlayer(nextTurnPlayer);
    setViewingPlayer(nextTurnPlayer);

    // ターン数を更新
    setTurnCount(prev => prev + 1);
    setTimeout(() => addLog(`ターン${turnCount + 1} 開始`, null), 0);

    // ターン終了トリガーをインクリメント（カード状態更新用）
    setTurnEndTrigger(prev => prev + 1);
  }

  // リセット
  function resetPlay() {
    setIsPlaying(false);
    setPlayer1(null);
    setPlayer2(null);
    setCurrentPlayer(1);
    setIsEvidenceCollapsed(false);
    setIsMulliganMode(false);
    setSelectedForMulligan([]);
  }

  // デッキ選択画面
  if (!isPlaying) {
    return (
      <DeckSelectScreen
        decks={decks}
        onSelectDecks={startPlay}
        onCreateDeck={createDeck}
      />
    );
  }

  // 現在のプレイヤーがいない場合（エラー）
  if (!currentPlayerState || !opponentPlayerState) {
    return <div>エラー: プレイヤー情報が見つかりません</div>;
  }

  // プレイ画面
  return (
    <>
      {/* ゲーム開始時のマリガン選択モーダル */}
      {!currentPlayerState.mulliganDone && !isMulliganMode && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "1rem"
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "1.25rem",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              textAlign: "center"
            }}
          >
            <h2 style={{ 
              margin: "0 0 0.6rem 0", 
              fontSize: "1rem",
              color: "#333"
            }}>
              🃏 {currentPlayer === 1 ? "先攻" : "後攻"}のマリガン
            </h2>
            
            {/* 手札表示 - 2段レイアウト（3枚+2枚） */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              marginBottom: "0.6rem"
            }}>
              {/* 1段目: 3枚 */}
              <div style={{
                display: "flex",
                justifyContent: "center",
                gap: "4px"
              }}>
                {currentPlayerState.hand.slice(0, 3).map((card, index) => (
                  <MulliganCardThumb key={index} card={card} />
                ))}
              </div>
              {/* 2段目: 2枚 */}
              <div style={{
                display: "flex",
                justifyContent: "center",
                gap: "4px"
              }}>
                {currentPlayerState.hand.slice(3, 5).map((card, index) => (
                  <MulliganCardThumb key={index + 3} card={card} />
                ))}
              </div>
            </div>
            
            <p style={{
              color: "#666",
              fontSize: "0.75rem",
              margin: "0 0 0.6rem 0"
            }}>
              手札を入れ替えますか？
            </p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <button
                onClick={startMulligan}
                style={{
                  padding: "0.65rem",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem"
                }}
              >
                🔄 マリガンする
              </button>
              <button
                onClick={skipMulligan}
                style={{
                  padding: "0.55rem",
                  background: "#e0e0e0",
                  color: "#333",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}
              >
                このままでOK
              </button>
            </div>
          </div>
        </div>
      )}

      <VersusPlayField
        currentPlayer={currentPlayer}
        turnPlayer={turnPlayer}
        currentPlayerState={currentPlayerState}
        opponentPlayerState={opponentPlayerState}
        partnerCard={partnerCard}
        incidentCard={incidentCard}
        onDrawCard={drawCard}
        onRefreshDeck={refreshDeck}
        onStartTurn={startTurn}
        onStartMulligan={startMulligan}
        onSwitchPlayer={switchPlayer}
        onEndTurn={endTurn}
        onReset={resetPlay}
        onCardClick={openCardMenu}
        onCardDetailClick={openCardDetail}
        onPartnerCardClick={openPartnerCardModal}
        partnerState={currentPlayerState.partnerState}
        opponentTraceFound={opponentPlayerState.traceFound}
        turnEndTrigger={turnEndTrigger}
        onToggleEvidenceCollapse={() => setIsEvidenceCollapsed(!isEvidenceCollapsed)}
        isEvidenceCollapsed={isEvidenceCollapsed}
        pendingSetCard={pendingSetCard}
        onPendingSetCardProcessed={() => setPendingSetCard(null)}
        removeSetCardsRequest={removeSetCardsRequest}
        newMulliganCardIndices={newMulliganCardIndices}
        onClearNewMulliganCards={() => setNewMulliganCardIndices([])}
        newHandCardIndices={newHandCardIndices}
        onClearNewHandCards={() => setNewHandCardIndices([])}
        newFieldCardIndices={newFieldCardIndices}
        onClearNewFieldCards={() => setNewFieldCardIndices([])}
        onShowLog={() => setShowLogModal(true)}
        onSetCardsRemoved={(cards, fieldIndex, player) => {
          // セットカードをリムーブへ追加
          if (cards.length > 0) {
            if (player === 1) {
              setPlayer1(prev => prev ? {
                ...prev,
                remove: [...prev.remove, ...cards]
              } : null);
            } else {
              setPlayer2(prev => prev ? {
                ...prev,
                remove: [...prev.remove, ...cards]
              } : null);
            }
          }
          // 要求をクリア
          setRemoveSetCardsRequest(null);
        }}
        onSetCardToRemove={(card, fieldIndex, setCardIndex, player) => {
          // セットカードをリムーブへ送る
          if (player === 1) {
            setPlayer1(prev => prev ? {
              ...prev,
              remove: [...prev.remove, card]
            } : null);
          } else {
            setPlayer2(prev => prev ? {
              ...prev,
              remove: [...prev.remove, card]
            } : null);
          }
        }}
      />

      <MulliganModal
        show={isMulliganMode}
        playHand={currentPlayerState.hand}
        selectedForMulligan={selectedForMulligan}
        onToggleSelect={toggleMulliganSelect}
        onExecute={executeMulligan}
        onCancel={cancelMulligan}
      />

      <CardMenuModal
        show={showCardMenu}
        selectedCard={selectedCard}
        evidenceFaceUp={currentPlayerState.evidenceFaceUp}
        onAction={handleMenuAction}
        onClose={() => setShowCardMenu(false)}
        fieldCards={currentPlayerState.field}
      />

      <CardDetailModal
        show={showCardDetail}
        card={detailCard}
        onClose={() => setShowCardDetail(false)}
      />

      <MoveDestinationModal
        show={showMoveDestination && selectedCard !== null && (selectedCard.location === "evidence" || selectedCard.location === "file")}
        onMoveToField={() => {
          if (selectedCard?.location === "evidence") {
            moveEvidenceCard(selectedCard.index, "field");
          } else if (selectedCard?.location === "file") {
            moveFileCard(selectedCard.index, "field");
          }
        }}
        onMoveToHand={() => {
          if (selectedCard?.location === "evidence") {
            moveEvidenceCard(selectedCard.index, "hand");
          } else if (selectedCard?.location === "file") {
            moveFileCard(selectedCard.index, "hand");
          }
        }}
        onMoveToRemove={() => {
          if (selectedCard?.location === "evidence") {
            moveEvidenceCard(selectedCard.index, "remove");
          } else if (selectedCard?.location === "file") {
            moveFileCard(selectedCard.index, "remove");
          }
        }}
        onMoveToDeck={() => {
          if (selectedCard?.location === "evidence") {
            moveEvidenceCard(selectedCard.index, "deck");
          } else if (selectedCard?.location === "file") {
            moveFileCard(selectedCard.index, "deck");
          }
        }}
        onClose={() => setShowMoveDestination(false)}
      />

      {/* リムーブからの移動モーダル */}
      {showRemoveMoveModal && selectedCard?.location === "remove" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
          onClick={() => setShowRemoveMoveModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ 
              margin: "0 0 1rem 0", 
              fontSize: "1.1rem",
              color: "#333"
            }}>
              {selectedCard.card.name}
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                onClick={() => moveRemoveCard(selectedCard.index, "field")}
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🎯 現場へ
              </button>
              <button
                onClick={() => moveRemoveCard(selectedCard.index, "hand")}
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                ✋ 手札へ
              </button>
              <button
                onClick={() => moveRemoveCard(selectedCard.index, "deck")}
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🎴 山札へ（一番下）
              </button>
              <button
                onClick={() => {
                  setDetailCard(selectedCard.card);
                  setShowCardDetail(true);
                  setShowRemoveMoveModal(false);
                }}
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🔍 拡大表示
              </button>
              <button
                onClick={() => setShowRemoveMoveModal(false)}
                style={{
                  padding: "0.75rem",
                  background: "#f5f5f5",
                  color: "#333",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  cursor: "pointer"
                }}
              >
                ◀ 閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 手札からの移動モーダル */}
      {showHandMoveModal && selectedCard?.location === "hand" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
          onClick={() => setShowHandMoveModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ 
              margin: "0 0 1rem 0", 
              fontSize: "1.1rem",
              color: "#333"
            }}>
              {selectedCard.card.name}
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                onClick={() => moveHandCard(selectedCard.index, "field")}
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🎯 現場へ
              </button>
              <button
                onClick={() => moveHandCard(selectedCard.index, "remove")}
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🗑️ リムーブへ
              </button>
              <button
                onClick={() => moveHandCard(selectedCard.index, "deck")}
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🎴 山札へ（一番下）
              </button>
              <button
                onClick={() => {
                  setDetailCard(selectedCard.card);
                  setShowCardDetail(true);
                  setShowHandMoveModal(false);
                }}
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🔍 拡大表示
              </button>
              <button
                onClick={() => setShowHandMoveModal(false)}
                style={{
                  padding: "0.75rem",
                  background: "#f5f5f5",
                  color: "#333",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  cursor: "pointer"
                }}
              >
                ◀ 閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* パートナーゾーンからの移動モーダル */}
      {showPartnerZoneMoveModal && selectedCard?.location === "partnerZone" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
          onClick={() => setShowPartnerZoneMoveModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ 
              margin: "0 0 1rem 0", 
              fontSize: "1.1rem",
              color: "#333"
            }}>
              {selectedCard.card.name}
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                onClick={() => movePartnerZoneCard(selectedCard.index, "field")}
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #f48fb1 0%, #e91e63 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🎯 現場へ
              </button>
              <button
                onClick={() => movePartnerZoneCard(selectedCard.index, "remove")}
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #f48fb1 0%, #e91e63 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🗑️ リムーブへ
              </button>
              <button
                onClick={() => {
                  setDetailCard(selectedCard.card);
                  setShowCardDetail(true);
                  setShowPartnerZoneMoveModal(false);
                }}
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #f48fb1 0%, #e91e63 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🔍 拡大表示
              </button>
              <button
                onClick={() => setShowPartnerZoneMoveModal(false)}
                style={{
                  padding: "0.75rem",
                  background: "#f5f5f5",
                  color: "#333",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  cursor: "pointer"
                }}
              >
                ◀ 閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* パートナーカードモーダル */}
      {showPartnerCardModal && detailCard && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
          onClick={() => setShowPartnerCardModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ 
              margin: "0 0 1rem 0", 
              fontSize: "1.1rem",
              color: "#333"
            }}>
              👤 {detailCard.name}
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                onClick={() => setPartnerState(currentPlayerState.partnerState === "reasoning" ? "normal" : "reasoning")}
                style={{
                  padding: "0.85rem",
                  background: currentPlayerState.partnerState === "reasoning"
                    ? "linear-gradient(135deg, #4caf50 0%, #388e3c 100%)"
                    : "linear-gradient(135deg, #f48fb1 0%, #e91e63 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🔄 推理 {currentPlayerState.partnerState === "reasoning" ? "（解除）" : "（横にする）"}
              </button>
              <button
                onClick={() => setPartnerState(currentPlayerState.partnerState === "assist" ? "normal" : "assist")}
                style={{
                  padding: "0.85rem",
                  background: currentPlayerState.partnerState === "assist"
                    ? "linear-gradient(135deg, #4caf50 0%, #388e3c 100%)"
                    : "linear-gradient(135deg, #f48fb1 0%, #e91e63 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🅿️ アシスト {currentPlayerState.partnerState === "assist" ? "（解除）" : "（FILEに表示）"}
              </button>
              <button
                onClick={() => {
                  setShowPartnerCardModal(false);
                  setShowCardDetail(true);
                }}
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #f48fb1 0%, #e91e63 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🔍 拡大表示
              </button>
              <button
                onClick={() => setShowPartnerCardModal(false)}
                style={{
                  padding: "0.75rem",
                  background: "#f5f5f5",
                  color: "#333",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  cursor: "pointer"
                }}
              >
                ◀ 閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ログモーダル */}
      {showLogModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
          onClick={() => setShowLogModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "1rem",
              width: "100%",
              maxWidth: "420px",
              maxHeight: "80vh",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              marginBottom: "0.75rem",
              borderBottom: "1px solid #eee",
              paddingBottom: "0.5rem"
            }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>📋 ゲームログ</h3>
              <button
                onClick={() => setShowLogModal(false)}
                style={{
                  background: "#e0e0e0",
                  border: "none",
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  fontSize: "1rem",
                  cursor: "pointer"
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ 
              flex: 1, 
              overflowY: "auto",
              fontSize: "0.85rem"
            }}>
              {gameLog.length === 0 ? (
                <div style={{ color: "#999", textAlign: "center", padding: "2rem" }}>
                  ログはまだありません
                </div>
              ) : (
                gameLog.map((log, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "0.4rem 0.5rem",
                      borderBottom: "1px solid #f0f0f0",
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "flex-start",
                      background: log.message.includes("ターン") && log.message.includes("開始") 
                        ? "#e3f2fd" 
                        : "transparent"
                    }}
                  >
                    <span style={{ color: "#999", fontSize: "0.75rem", flexShrink: 0 }}>
                      {log.time}
                    </span>
                    {log.player && (
                      <span style={{ 
                        background: log.player === 1 ? "#2196f3" : "#f44336",
                        color: "white",
                        padding: "0 0.3rem",
                        borderRadius: "3px",
                        fontSize: "0.7rem",
                        flexShrink: 0
                      }}>
                        P{log.player}
                      </span>
                    )}
                    <span style={{ flex: 1 }}>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* セット先選択モーダル */}
      <SetTargetModal
        show={showSetTargetModal}
        fieldCards={currentPlayerState.field}
        onSelectTarget={(fieldIndex) => {
          if (selectedCard && selectedCard.location === "hand") {
            // 手札から削除
            const cardToSet = currentPlayerState.hand[selectedCard.index];
            const newHand = currentPlayerState.hand.filter((_, i) => i !== selectedCard.index);
            updatePlayerState(currentPlayer, { hand: newHand });
            
            // VersusPlayFieldにセットカード追加を通知
            setPendingSetCard({
              card: cardToSet,
              fieldIndex: fieldIndex,
              player: currentPlayer
            });
          }
          setShowSetTargetModal(false);
          setSelectedCard(null);
        }}
        onClose={() => {
          setShowSetTargetModal(false);
        }}
      />
    </>
  );
}
