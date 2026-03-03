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
      width: "50px",
      height: "70px",
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
  partnerZone: Card[]; // パートナーエリアに置いたカード
  evidenceFaceUp: Set<number | undefined>;
  mulliganDone: boolean;
}

export function PlayScreen({ decks, cards, createDeck }: PlayScreenProps) {
  // ゲーム状態
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1); // 現在操作中のプレイヤー
  
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
  
  // モーダル表示状態
  const [showCardMenu, setShowCardMenu] = useState(false);
  const [selectedCard, setSelectedCard] = useState<{ 
    card: Card; 
    index: number; 
    location: "hand" | "field" | "remove" | "evidence" | "file" 
  } | null>(null);
  const [showMoveDestination, setShowMoveDestination] = useState(false);
  const [showRemoveMoveModal, setShowRemoveMoveModal] = useState(false); // リムーブからの移動モーダル
  const [showHandMoveModal, setShowHandMoveModal] = useState(false); // 手札からの移動モーダル
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

  // パートナーと事件カードを取得
  const partnerCard = cards.find(c => c.type === "パートナー") ?? null;
  const incidentCard = cards.find(c => c.type === "事件") ?? null;

  // 現在のプレイヤーの状態を取得
  const currentPlayerState = currentPlayer === 1 ? player1 : player2;
  const opponentPlayerState = currentPlayer === 1 ? player2 : player1;

  // プレイヤーの状態を更新
  function updatePlayerState(playerNum: 1 | 2, updates: Partial<PlayerState>) {
    if (playerNum === 1) {
      setPlayer1(prev => prev ? { ...prev, ...updates } : null);
    } else {
      setPlayer2(prev => prev ? { ...prev, ...updates } : null);
    }
  }

  // ゲーム開始
  async function startPlay(player1DeckId: number, player2DeckId: number) {
    // プレイヤー1のデッキを初期化
    const p1State = await initializeDeck(player1DeckId);
    if (!p1State) return;
    
    // プレイヤー2のデッキを初期化
    const p2State = await initializeDeck(player2DeckId);
    if (!p2State) return;

    setPlayer1(p1State);
    setPlayer2(p2State);
    setCurrentPlayer(1);
    setIsPlaying(true);
  }

  // デッキを初期化してPlayerStateを返す
  async function initializeDeck(deckId: number): Promise<PlayerState | null> {
    const dcs = await db.deckCards.where("deckId").equals(deckId).toArray();
    
    const allPlayCards: Card[] = [];
    for (const dc of dcs) {
      const card = await db.cards.get(dc.cardId);
      if (card && card.type !== "パートナー" && card.type !== "事件") {
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

    // 初期配置
    const hand = shuffled.slice(0, 5);
    const fileCard = shuffled.slice(5, 6);
    const deck = shuffled.slice(6);

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
      mulliganDone: false
    };
  }

  // カードドロー
  function drawCard() {
    if (!currentPlayerState || currentPlayerState.deck.length === 0) {
      alert("デッキにカードがありません！");
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
    setShowFieldMoveModal(false);
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
  function openCardMenu(card: Card, index: number, location: "hand" | "field" | "remove" | "evidence" | "file") {
    setSelectedCard({ card, index, location });
    setShowCardMenu(true);
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
    
    setIsMulliganMode(false);
    setSelectedForMulligan([]);
  }

  // ターン切り替え（上下逆転）- ハイライトは消さない
  function switchPlayer() {
    setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
  }

  // ターン終了（相手のターンへ）
  function endTurn() {
    // ターン終了時に新カードハイライトをリセット
    setNewHandCardIndices([]);
    setNewFieldCardIndices([]);
    setNewMulliganCardIndices([]);
    setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
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
              maxWidth: "280px",
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
        currentPlayerState={currentPlayerState}
        opponentPlayerState={opponentPlayerState}
        partnerCard={partnerCard}
        incidentCard={incidentCard}
        onDrawCard={drawCard}
        onStartTurn={startTurn}
        onStartMulligan={startMulligan}
        onSwitchPlayer={switchPlayer}
        onEndTurn={endTurn}
        onReset={resetPlay}
        onCardClick={openCardMenu}
        onCardDetailClick={openCardDetail}
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
              maxWidth: "280px",
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
              maxWidth: "280px",
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
