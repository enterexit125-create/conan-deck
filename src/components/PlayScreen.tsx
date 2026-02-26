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
  
  // モーダル表示状態
  const [showCardMenu, setShowCardMenu] = useState(false);
  const [selectedCard, setSelectedCard] = useState<{ 
    card: Card; 
    index: number; 
    location: "hand" | "field" | "remove" | "evidence" | "file" 
  } | null>(null);
  const [showMoveDestination, setShowMoveDestination] = useState(false);
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
    
    updatePlayerState(currentPlayer, {
      hand: [...currentPlayerState.hand, newCard],
      deck: newDeck
    });
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
    
    updatePlayerState(currentPlayer, {
      hand: newHand,
      field: [...currentPlayerState.field, card]
    });
    setShowCardMenu(false);
  }

  // 現場からリムーブへ
  function moveCardToRemove(index: number) {
    if (!currentPlayerState) return;
    
    const card = currentPlayerState.field[index];
    const newField = currentPlayerState.field.filter((_, i) => i !== index);
    
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
  function handleMenuAction(action: "play" | "remove" | "evidence" | "view" | "toggleFace" | "move" | "setToField") {
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
          moveCardToRemove(selectedCard.index);
        }
        break;
      case "evidence":
        if (selectedCard.location === "field") {
          moveCardToEvidence(selectedCard.index);
        }
        break;
      case "toggleFace":
        if (selectedCard.location === "evidence") {
          toggleEvidenceFaceUp(selectedCard.card.id);
          setShowCardMenu(false);
        }
        break;
      case "move":
        setShowMoveDestination(true);
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
    const confirm = window.confirm("マリガンを開始しますか？");
    if (!confirm) return;
    
    setIsMulliganMode(true);
    setSelectedForMulligan([]);
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

    updatePlayerState(currentPlayer, {
      hand: [...remainingHand, ...drawnCards],
      deck: finalDeck,
      mulliganDone: true
    });
    
    setIsMulliganMode(false);
    setSelectedForMulligan([]);
  }

  // ターン切り替え（上下逆転）
  function switchPlayer() {
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
        onReset={resetPlay}
        onCardClick={openCardMenu}
        onCardDetailClick={openCardDetail}
        onToggleEvidenceCollapse={() => setIsEvidenceCollapsed(!isEvidenceCollapsed)}
        isEvidenceCollapsed={isEvidenceCollapsed}
        pendingSetCard={pendingSetCard}
        onPendingSetCardProcessed={() => setPendingSetCard(null)}
        onFlipSetCard={(card, fieldIndex, setCardIndex, player) => {
          // セットカードを表に返す → 現場に追加
          const targetState = player === 1 ? player1 : player2;
          if (targetState) {
            if (player === 1) {
              setPlayer1(prev => prev ? {
                ...prev,
                field: [...prev.field, card]
              } : null);
            } else {
              setPlayer2(prev => prev ? {
                ...prev,
                field: [...prev.field, card]
              } : null);
            }
          }
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
