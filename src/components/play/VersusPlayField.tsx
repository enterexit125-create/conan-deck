import { useState, useEffect } from "react";
import type { Card } from "../../db";
import { HandArea } from "./areas/HandArea";
import { LeftSidePanel } from "./panels/LeftSidePanel";
import { RightSidePanel } from "./panels/RightSidePanel";
import { CardStatusBadge, CardStatusModal, type CardStatus, type CardState } from "./panels/CardStatusBadge";
import cardBackImage from "/card-back.png";

interface PlayerState {
  deck: Card[];
  hand: Card[];
  field: Card[];
  remove: Card[];
  evidence: Card[];
  file: Card[];
  evidenceFaceUp: Set<number | undefined>;
  mulliganDone: boolean;
}

interface VersusPlayFieldProps {
  currentPlayer: 1 | 2;
  currentPlayerState: PlayerState;
  opponentPlayerState: PlayerState;
  partnerCard: Card | null;
  incidentCard: Card | null;
  onDrawCard: () => void;
  onStartTurn: () => void;
  onStartMulligan: () => void;
  onSwitchPlayer: () => void;
  onEndTurn: () => void;  // ターン終了
  onReset: () => void;
  onCardClick: (card: Card, index: number, location: "hand" | "field" | "remove" | "evidence" | "file") => void;
  onCardDetailClick: (card: Card) => void;
  onToggleEvidenceCollapse: () => void;
  isEvidenceCollapsed: boolean;
  // セットカード用のコールバック
  onSetCardToRemove?: (card: Card, fieldIndex: number, setCardIndex: number, player: 1 | 2) => void;
  // 外部からセットカードを追加するためのpending state
  pendingSetCard?: { card: Card; fieldIndex: number; player: 1 | 2 } | null;
  onPendingSetCardProcessed?: () => void;
  // セットカードの取得・削除要求
  removeSetCardsRequest?: { fieldIndex: number; player: 1 | 2 } | null;
  onSetCardsRemoved?: (cards: Card[], fieldIndex: number, player: 1 | 2) => void;
}

// カードサイズの定数（スマホ向け・3枚横並び）
const CARD_WIDTH = 76;  // 90pxと63pxの中間
const CARD_GAP = "0.5rem";

// プレイヤーカラーテーマ
const PLAYER_THEMES = {
  1: {
    primary: "#667eea",
    secondary: "#764ba2",
    background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
    headerBg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    opponentBg: "linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)",
    opponentHeader: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
    handBg: "linear-gradient(to top, #34495e 0%, #2c3e50 100%)",
    fieldTitle: "#667eea",
    fieldCardBg: "white",
    label: "P1",
    emoji: "🔵"
  },
  2: {
    primary: "#e74c3c",
    secondary: "#c0392b",
    background: "linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)",
    headerBg: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
    opponentBg: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
    opponentHeader: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    handBg: "linear-gradient(to top, #4a2c2c 0%, #3d2020 100%)",
    fieldTitle: "#e74c3c",
    fieldCardBg: "#f0f0f0",
    label: "P2",
    emoji: "🔴"
  }
};

// ステータスのキーを生成（カードID + インデックス + プレイヤー）
function getStatusKey(cardId: number | undefined, index: number, player: 1 | 2): string {
  return `${player}-${cardId ?? "unknown"}-${index}`;
}

// セットカードのキーを生成（現場のカードのインデックス + プレイヤー）
function getSetCardsKey(fieldIndex: number, player: 1 | 2): string {
  return `${player}-field-${fieldIndex}`;
}

export function VersusPlayField({
  currentPlayer,
  currentPlayerState,
  opponentPlayerState,
  partnerCard,
  incidentCard,
  onDrawCard,
  onStartTurn,
  onStartMulligan,
  onSwitchPlayer,
  onEndTurn,
  onReset,
  onCardClick,
  onCardDetailClick,
  onToggleEvidenceCollapse,
  isEvidenceCollapsed,
  onSetCardToRemove,
  pendingSetCard,
  onPendingSetCardProcessed,
  removeSetCardsRequest,
  onSetCardsRemoved
}: VersusPlayFieldProps) {
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  
  // 相手の現場の開閉状態
  const [isOpponentFieldOpen, setIsOpponentFieldOpen] = useState(true);

  // カードステータスの管理（キー: "プレイヤー-カードID-インデックス"）
  const [cardStatuses, setCardStatuses] = useState<Map<string, CardStatus>>(new Map());

  // カード状態の管理（アクティブ/スリープ/スタン）
  const [cardStates, setCardStates] = useState<Map<string, CardState>>(new Map());

  // セットカードの管理（キー: "プレイヤー-field-インデックス" → カードと表裏状態の配列）
  interface SetCardInfo {
    card: Card;
    faceUp: boolean;  // true: 表向き, false: 裏向き
  }
  const [setCards, setSetCards] = useState<Map<string, SetCardInfo[]>>(new Map());

  // 外部からのセットカード追加を処理
  useEffect(() => {
    if (pendingSetCard) {
      addSetCard(pendingSetCard.fieldIndex, pendingSetCard.player, pendingSetCard.card);
      if (onPendingSetCardProcessed) {
        onPendingSetCardProcessed();
      }
    }
  }, [pendingSetCard]);

  // 外部からのセットカード削除要求を処理
  useEffect(() => {
    if (removeSetCardsRequest) {
      const removedCards = removeAllSetCardsForField(
        removeSetCardsRequest.fieldIndex,
        removeSetCardsRequest.player
      );
      // インデックスを更新
      updateSetCardIndices(removeSetCardsRequest.player, removeSetCardsRequest.fieldIndex);
      
      if (onSetCardsRemoved) {
        onSetCardsRemoved(
          removedCards,
          removeSetCardsRequest.fieldIndex,
          removeSetCardsRequest.player
        );
      }
    }
  }, [removeSetCardsRequest]);

  // ステータスモーダルの状態
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedCardForStatus, setSelectedCardForStatus] = useState<{
    card: Card;
    index: number;
    player: 1 | 2;
  } | null>(null);

  // セットカード一覧モーダルの状態
  const [setCardListModalOpen, setSetCardListModalOpen] = useState(false);
  const [selectedFieldForSetList, setSelectedFieldForSetList] = useState<{
    fieldIndex: number;
    player: 1 | 2;
  } | null>(null);

  // セットカード詳細モーダルの状態
  const [setCardDetailModalOpen, setSetCardDetailModalOpen] = useState(false);
  const [selectedSetCardInfo, setSelectedSetCardInfo] = useState<{
    fieldIndex: number;
    player: 1 | 2;
    setCardIndex: number;
    card: Card;
    faceUp: boolean;
  } | null>(null);

  // 現在のプレイヤーのテーマを取得
  const theme = PLAYER_THEMES[currentPlayer];
  const opponentPlayer = currentPlayer === 1 ? 2 : 1;

  // ステータスを取得（なければ初期値を返す）
  function getCardStatus(cardId: number | undefined, index: number, player: 1 | 2): CardStatus {
    const key = getStatusKey(cardId, index, player);
    return cardStatuses.get(key) ?? { lv: 0, ap: 0, lp: 0 };
  }

  // ステータスを更新
  function updateCardStatus(cardId: number | undefined, index: number, player: 1 | 2, newStatus: CardStatus) {
    const key = getStatusKey(cardId, index, player);
    setCardStatuses(prev => {
      const newMap = new Map(prev);
      if (newStatus.lv === 0 && newStatus.ap === 0 && newStatus.lp === 0) {
        newMap.delete(key);
      } else {
        newMap.set(key, newStatus);
      }
      return newMap;
    });
  }

  // カード状態を取得（なければアクティブ）
  function getCardState(cardId: number | undefined, index: number, player: 1 | 2): CardState {
    const key = getStatusKey(cardId, index, player);
    return cardStates.get(key) ?? "active";
  }

  // カード状態を更新
  function updateCardState(cardId: number | undefined, index: number, player: 1 | 2, newState: CardState) {
    const key = getStatusKey(cardId, index, player);
    setCardStates(prev => {
      const newMap = new Map(prev);
      if (newState === "active") {
        newMap.delete(key);
      } else {
        newMap.set(key, newState);
      }
      return newMap;
    });
  }

  // セットカードを取得
  function getSetCardsForField(fieldIndex: number, player: 1 | 2): SetCardInfo[] {
    const key = getSetCardsKey(fieldIndex, player);
    return setCards.get(key) ?? [];
  }

  // セットカードを追加（裏向きで追加）
  function addSetCard(fieldIndex: number, player: 1 | 2, card: Card) {
    const key = getSetCardsKey(fieldIndex, player);
    setSetCards(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(key) ?? [];
      newMap.set(key, [...existing, { card, faceUp: false }]);
      return newMap;
    });
  }

  // セットカードを削除
  function removeSetCard(fieldIndex: number, player: 1 | 2, setCardIndex: number): Card | null {
    const key = getSetCardsKey(fieldIndex, player);
    const existing = setCards.get(key) ?? [];
    const removedCardInfo = existing[setCardIndex];
    
    if (!removedCardInfo) return null;
    
    setSetCards(prev => {
      const newMap = new Map(prev);
      const existingCards = newMap.get(key) ?? [];
      const newCards = existingCards.filter((_, i) => i !== setCardIndex);
      if (newCards.length === 0) {
        newMap.delete(key);
      } else {
        newMap.set(key, newCards);
      }
      return newMap;
    });
    
    return removedCardInfo.card;
  }

  // セットカードを表に返す（削除せずに表向きにする）
  function flipSetCard(fieldIndex: number, player: 1 | 2, setCardIndex: number) {
    const key = getSetCardsKey(fieldIndex, player);
    setSetCards(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(key) ?? [];
      const updated = existing.map((item, i) => 
        i === setCardIndex ? { ...item, faceUp: true } : item
      );
      newMap.set(key, updated);
      return newMap;
    });
  }

  // 現場カードに紐づくセットカードを全て取得して削除
  function removeAllSetCardsForField(fieldIndex: number, player: 1 | 2): Card[] {
    const key = getSetCardsKey(fieldIndex, player);
    const existing = setCards.get(key) ?? [];
    const cards = existing.map(info => info.card);
    
    if (cards.length > 0) {
      setSetCards(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    }
    
    return cards;
  }

  // 現場カードのインデックスが変わった時にセットカードのキーも更新
  function updateSetCardIndices(player: 1 | 2, removedIndex: number) {
    setSetCards(prev => {
      const newMap = new Map<string, SetCardInfo[]>();
      prev.forEach((value, key) => {
        // このプレイヤーのfield用のキーかチェック
        const prefix = `${player}-field-`;
        if (key.startsWith(prefix)) {
          const indexStr = key.substring(prefix.length);
          const index = parseInt(indexStr, 10);
          if (index > removedIndex) {
            // インデックスを1つ減らす
            const newKey = `${player}-field-${index - 1}`;
            newMap.set(newKey, value);
          } else if (index < removedIndex) {
            // そのまま保持
            newMap.set(key, value);
          }
          // index === removedIndex は削除済みなのでスキップ
        } else {
          // 他のプレイヤーのキーはそのまま
          newMap.set(key, value);
        }
      });
      return newMap;
    });
  }

  // カード状態に応じた回転角度を取得
  function getCardRotation(state: CardState): string {
    switch (state) {
      case "sleep": return "rotate(-90deg)";
      case "stun": return "rotate(180deg)";
      default: return "rotate(0deg)";
    }
  }

  // カードタップ時の処理
  function handleCardTap(card: Card, index: number, player: 1 | 2) {
    setSelectedCardForStatus({ card, index, player });
    setStatusModalOpen(true);
  }

  // ステータスバッジタップ時の処理（同じくモーダルを開く）
  function handleBadgeTap(card: Card, index: number, player: 1 | 2) {
    setSelectedCardForStatus({ card, index, player });
    setStatusModalOpen(true);
  }

  // カード状態を変更
  function handleCardStateChange(newState: CardState) {
    if (selectedCardForStatus) {
      updateCardState(
        selectedCardForStatus.card.id,
        selectedCardForStatus.index,
        selectedCardForStatus.player,
        newState
      );
    }
  }

  // 移動メニューを開く（既存のCardMenuModalを使用）
  function handleMoveMenu() {
    if (selectedCardForStatus && selectedCardForStatus.player === currentPlayer) {
      onCardClick(selectedCardForStatus.card, selectedCardForStatus.index, "field");
    }
  }

  // 詳細を見る
  function handleViewDetail() {
    if (selectedCardForStatus) {
      onCardDetailClick(selectedCardForStatus.card);
    }
    setStatusModalOpen(false);
  }

  // セットカード一覧モーダルを開く
  function openSetCardListModal(fieldIndex: number, player: 1 | 2) {
    setSelectedFieldForSetList({ fieldIndex, player });
    setSetCardListModalOpen(true);
  }

  // セットカード一覧から個別カードを選択
  function handleSelectSetCardFromList(setCardIndex: number, card: Card, faceUp: boolean) {
    if (!selectedFieldForSetList) return;
    setSelectedSetCardInfo({
      fieldIndex: selectedFieldForSetList.fieldIndex,
      player: selectedFieldForSetList.player,
      setCardIndex,
      card,
      faceUp
    });
    setSetCardListModalOpen(false);
    setSetCardDetailModalOpen(true);
  }

  // セットカードをタップしたとき
  function handleSetCardTap(fieldIndex: number, player: 1 | 2, setCardIndex: number, card: Card, faceUp: boolean) {
    setSelectedSetCardInfo({ fieldIndex, player, setCardIndex, card, faceUp });
    setSetCardDetailModalOpen(true);
  }

  // セットカードを表に返す（セットされたまま表向きにする）
  function handleFlipSetCard() {
    if (!selectedSetCardInfo) return;
    
    flipSetCard(
      selectedSetCardInfo.fieldIndex,
      selectedSetCardInfo.player,
      selectedSetCardInfo.setCardIndex
    );
    
    setSetCardDetailModalOpen(false);
    setSelectedSetCardInfo(null);
  }

  // セットカードをリムーブに送る
  function handleSetCardToRemove() {
    if (!selectedSetCardInfo) return;
    
    const removedCard = removeSetCard(
      selectedSetCardInfo.fieldIndex,
      selectedSetCardInfo.player,
      selectedSetCardInfo.setCardIndex
    );
    
    // 親コンポーネントに通知
    if (onSetCardToRemove && removedCard) {
      onSetCardToRemove(
        removedCard,
        selectedSetCardInfo.fieldIndex,
        selectedSetCardInfo.setCardIndex,
        selectedSetCardInfo.player
      );
    }
    
    setSetCardDetailModalOpen(false);
    setSelectedSetCardInfo(null);
  }

  // フィールドカードコンポーネント（セットカード付き）
  function FieldCardWithSet({ 
    card, 
    idx, 
    player, 
    status, 
    cardState 
  }: { 
    card: Card; 
    idx: number; 
    player: 1 | 2; 
    status: CardStatus;
    cardState: CardState;
  }) {
    const rotation = getCardRotation(cardState);
    const setCardsForThis = getSetCardsForField(idx, player);
    
    return (
      <div
        style={{
          position: "relative",
          width: `${CARD_WIDTH}px`,
          flexShrink: 0
        }}
      >
        {/* メインカード */}
        <div
          onClick={() => handleCardTap(card, idx, player)}
          style={{
            width: `${CARD_WIDTH}px`,
            aspectRatio: "0.7",
            borderRadius: "4px",
            overflow: "visible",
            cursor: "pointer",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div style={{
            width: "100%",
            height: "100%",
            borderRadius: "4px",
            overflow: "hidden",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transform: rotation,
            transition: "transform 0.3s ease"
          }}>
            {card.image ? (
              <img
                src={URL.createObjectURL(card.image)}
                alt={card.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{
                width: "100%",
                height: "100%",
                background: `linear-gradient(135deg, ${PLAYER_THEMES[player].primary} 0%, ${PLAYER_THEMES[player].secondary} 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "0.6rem",
                padding: "0.2rem",
                textAlign: "center"
              }}>
                {card.name}
              </div>
            )}
          </div>
          {/* ステータスバッジ */}
          <CardStatusBadge
            status={status}
            onTap={() => handleBadgeTap(card, idx, player)}
          />
          
          {/* セットカード枚数バッジ（タップで一覧表示） */}
          {setCardsForThis.length > 0 && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                openSetCardListModal(idx, player);
              }}
              style={{
                position: "absolute",
                bottom: "-6px",
                right: "-6px",
                background: "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)",
                color: "white",
                borderRadius: "12px",
                minWidth: "28px",
                height: "28px",
                padding: "0 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.8rem",
                fontWeight: "bold",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                border: "2px solid white",
                cursor: "pointer",
                gap: "2px"
              }}
            >
              <span style={{ fontSize: "0.7rem" }}>📥</span>
              {setCardsForThis.length}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      height: "100svh", 
      maxHeight: "-webkit-fill-available",
      display: "flex", 
      flexDirection: "column",
      overflow: "hidden",
      background: theme.background,
      transition: "background 0.4s ease"
    }}>
        {/* ヘッダー - プレイヤーに応じて色が変わる */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.4rem 0.75rem",
          background: theme.headerBg,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          zIndex: 10,
          flexShrink: 0,
          transition: "background 0.4s ease"
        }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: "1rem", 
            fontWeight: "bold",
            color: "white",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.3)",
              fontSize: "0.9rem"
            }}>
              {theme.emoji}
            </span>
            {theme.label}を操作中
          </h2>
          <button 
            onClick={onReset} 
            style={{ 
              padding: "0.3rem 0.6rem", 
              fontSize: "0.85rem",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              borderRadius: "6px",
              color: "white",
              cursor: "pointer"
            }}
          >
            🔙 戻る
          </button>
        </div>

        {/* 相手の現場（アコーディオン式） */}
        <div style={{ 
          background: theme.opponentBg,
          transition: "background 0.4s ease",
          flexShrink: 0
        }}>
        {/* ヘッダー（タップで開閉） */}
        <div
          onClick={() => setIsOpponentFieldOpen(!isOpponentFieldOpen)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.3rem 0.75rem",
            background: theme.opponentHeader,
            color: "white",
            cursor: "pointer",
            userSelect: "none",
            transition: "background 0.4s ease"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem" }}>👤</span>
            <span style={{ fontSize: "0.8rem", fontWeight: "bold" }}>
              相手（{PLAYER_THEMES[opponentPlayer].label}）の現場
            </span>
            <span style={{
              background: "rgba(255,255,255,0.3)",
              padding: "0.1rem 0.5rem",
              borderRadius: "10px",
              fontSize: "0.75rem"
            }}>
              {opponentPlayerState.field.length}
            </span>
          </div>
          <span style={{
            fontSize: "0.8rem",
            transition: "transform 0.2s",
            transform: isOpponentFieldOpen ? "rotate(180deg)" : "rotate(0deg)"
          }}>
            ▼
          </span>
        </div>

        {/* コンテンツ（アニメーション付き） */}
        <div style={{
          maxHeight: isOpponentFieldOpen ? (opponentPlayerState.field.length === 0 ? "32px" : "240px") : "0",
          overflow: "hidden",
          transition: "max-height 0.3s ease"
        }}>
          <div style={{ 
            padding: "0.1rem 0",
            minHeight: 0
          }}>
            <div style={{ 
              background: PLAYER_THEMES[opponentPlayer].fieldCardBg,
              borderRadius: "0",
              padding: "0.2rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              margin: "0 0.2rem",
              transition: "background 0.4s ease"
            }}>
              {opponentPlayerState.field.length === 0 ? (
                <div style={{ 
                  padding: "0.5rem", 
                  textAlign: "center", 
                  color: "#999",
                  fontSize: "0.8rem"
                }}>
                  カードなし
                </div>
              ) : (
                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: CARD_GAP,
                  padding: "0.3rem",
                  alignItems: "flex-start",
                  justifyContent: "center"
                }}>
                  {opponentPlayerState.field.map((card, idx) => {
                    const status = getCardStatus(card.id, idx, opponentPlayer);
                    const cardState = getCardState(card.id, idx, opponentPlayer);
                    
                    return (
                      <FieldCardWithSet
                        key={`opponent-field-${card.id}-${idx}`}
                        card={card}
                        idx={idx}
                        player={opponentPlayer}
                        status={status}
                        cardState={cardState}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 中央コントロール - プレイヤー切り替えボタン */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.3rem",
        background: "white",
        borderTop: "1px solid #ddd",
        borderBottom: "1px solid #ddd",
        flexShrink: 0,
        zIndex: 5
      }}>
        <button
          className="btn-primary"
          onClick={() => setLeftPanelOpen(true)}
          style={{ 
            padding: "0.5rem 0.8rem", 
            fontSize: "1.1rem", 
            lineHeight: 1,
            background: theme.headerBg,
            border: "none",
            color: "white",
            borderRadius: "6px",
            transition: "background 0.4s ease"
          }}
        >
          ◀
        </button>
        
        {/* プレイヤー切り替えボタン */}
        <button
          onClick={onSwitchPlayer}
          style={{ 
            padding: "0.4rem 0.8rem", 
            fontSize: "0.8rem",
            lineHeight: 1.2,
            background: currentPlayer === 1 
              ? "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)"
              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "2px solid white",
            borderRadius: "6px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            transition: "all 0.3s ease"
          }}
        >
          <span>🔄</span>
          <span style={{ fontWeight: "bold" }}>
            {currentPlayer === 1 ? "P2へ" : "P1へ"}
          </span>
        </button>

        {/* ターン終了ボタン */}
        <button
          onClick={onEndTurn}
          style={{ 
            padding: "0.4rem 0.8rem", 
            fontSize: "0.8rem",
            lineHeight: 1.2,
            background: "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
            color: "white",
            border: "2px solid white",
            borderRadius: "6px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            transition: "all 0.3s ease"
          }}
        >
          <span>⏭️</span>
          <span style={{ fontWeight: "bold" }}>
            ターン終了
          </span>
        </button>

        <button
          className="btn-primary"
          onClick={() => setRightPanelOpen(true)}
          style={{ 
            padding: "0.5rem 0.8rem", 
            fontSize: "1.1rem", 
            lineHeight: 1,
            background: theme.headerBg,
            border: "none",
            color: "white",
            borderRadius: "6px",
            transition: "background 0.4s ease"
          }}
        >
          ▶
        </button>
      </div>

      {/* 自分の現場 */}
      <div style={{ 
        flex: 1,
        minHeight: 0,
        padding: "0.2rem 0",
        background: "transparent",
        transition: "background 0.4s ease, border-color 0.4s ease",
        display: "flex",
        flexDirection: "column"
      }}>
        <div style={{ 
          flex: 1,
          minHeight: 0,
          background: theme.fieldCardBg,
          borderRadius: "8px",
          padding: "0.2rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          margin: "0 0.2rem",
          transition: "background 0.4s ease",
          overflow: "hidden"
        }}>
          <div style={{ 
            fontSize: "0.75rem",
            fontWeight: "bold", 
            color: theme.fieldTitle,
            textAlign: "center",
            marginBottom: "0.15rem",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.3rem",
            transition: "color 0.4s ease"
          }}>
            <span>{theme.emoji}</span>
            <span>自分（{theme.label}）の現場</span>
          </div>
          {currentPlayerState.field.length === 0 ? (
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
              fontSize: "0.8rem"
            }}>
              カードなし
            </div>
          ) : (
            <div style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              display: "flex",
              flexWrap: "wrap",
              gap: CARD_GAP,
              alignContent: "flex-start",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: "0.3rem"
            }}>
              {currentPlayerState.field.map((card, idx) => {
                const status = getCardStatus(card.id, idx, currentPlayer);
                const cardState = getCardState(card.id, idx, currentPlayer);
                
                return (
                  <FieldCardWithSet
                    key={`current-field-${card.id}-${idx}`}
                    card={card}
                    idx={idx}
                    player={currentPlayer}
                    status={status}
                    cardState={cardState}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 自分の手札 - 画面下部に固定 */}
      <div style={{
        padding: "0.2rem",
        background: theme.handBg,
        flexShrink: 0,
        height: "125px",
        transition: "background 0.4s ease"
      }}>
        <HandArea
          playHand={currentPlayerState.hand}
          mulliganDone={currentPlayerState.mulliganDone}
          onCardClick={(card, index) => onCardClick(card, index, "hand")}
          onStartMulligan={onStartMulligan}
        />
      </div>

      {/* 左サイドパネル */}
      <LeftSidePanel
        isOpen={leftPanelOpen}
        playEvidence={currentPlayerState.evidence}
        playRemove={currentPlayerState.remove}
        evidenceFaceUp={currentPlayerState.evidenceFaceUp}
        isEvidenceCollapsed={isEvidenceCollapsed}
        onToggleEvidenceCollapse={onToggleEvidenceCollapse}
        onEvidenceCardClick={(card, index) => onCardClick(card, index, "evidence")}
        onRemoveCardClick={(card, index) => onCardClick(card, index, "remove")}
        onClose={() => setLeftPanelOpen(false)}
      />

      {/* 右サイドパネル */}
      <RightSidePanel
        isOpen={rightPanelOpen}
        deckCount={currentPlayerState.deck.length}
        playFile={currentPlayerState.file}
        partnerCard={partnerCard}
        incidentCard={incidentCard}
        onDrawCard={onDrawCard}
        onStartTurn={onStartTurn}
        onFileCardClick={(card, index) => onCardClick(card, index, "file")}
        onPartnerClick={onCardDetailClick}
        onIncidentClick={onCardDetailClick}
        onClose={() => setRightPanelOpen(false)}
      />

      {/* ステータス操作モーダル */}
      {selectedCardForStatus && (
        <CardStatusModal
          show={statusModalOpen}
          cardName={selectedCardForStatus.card.name ?? "カード"}
          status={getCardStatus(
            selectedCardForStatus.card.id,
            selectedCardForStatus.index,
            selectedCardForStatus.player
          )}
          cardState={getCardState(
            selectedCardForStatus.card.id,
            selectedCardForStatus.index,
            selectedCardForStatus.player
          )}
          onStatusChange={(newStatus) => updateCardStatus(
            selectedCardForStatus.card.id,
            selectedCardForStatus.index,
            selectedCardForStatus.player,
            newStatus
          )}
          onCardStateChange={handleCardStateChange}
          onMoveMenu={handleMoveMenu}
          onViewDetail={handleViewDetail}
          onClose={() => setStatusModalOpen(false)}
        />
      )}

      {/* セットカード一覧モーダル */}
      {setCardListModalOpen && selectedFieldForSetList && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
          onClick={() => setSetCardListModalOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "350px",
              maxHeight: "80vh",
              overflow: "auto"
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ 
              margin: "0 0 1rem 0", 
              fontSize: "1.1rem",
              textAlign: "center",
              color: "#ff9800",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem"
            }}>
              📥 セットカード一覧
            </h3>
            
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.75rem"
            }}>
              {getSetCardsForField(selectedFieldForSetList.fieldIndex, selectedFieldForSetList.player).map((setCardInfo, setIdx) => (
                <div
                  key={`set-list-${setIdx}`}
                  onClick={() => handleSelectSetCardFromList(setIdx, setCardInfo.card, setCardInfo.faceUp)}
                  style={{
                    aspectRatio: "0.7",
                    borderRadius: "8px",
                    overflow: "hidden",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    border: setCardInfo.faceUp ? "2px solid #4caf50" : "2px solid transparent",
                    position: "relative"
                  }}
                >
                  {/* 表向き/裏向きで表示を切り替え */}
                  {setCardInfo.faceUp ? (
                    setCardInfo.card.image ? (
                      <img
                        src={URL.createObjectURL(setCardInfo.card.image)}
                        alt={setCardInfo.card.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
                        fontSize: "0.6rem",
                        padding: "0.2rem",
                        textAlign: "center"
                      }}>
                        {setCardInfo.card.name}
                      </div>
                    )
                  ) : (
                    <img
                      src={cardBackImage}
                      alt={`セットカード ${setIdx + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                  {/* 番号バッジ */}
                  <div style={{
                    position: "absolute",
                    top: "4px",
                    left: "4px",
                    background: setCardInfo.faceUp ? "#4caf50" : "#ff9800",
                    color: "white",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.7rem",
                    fontWeight: "bold"
                  }}>
                    {setIdx + 1}
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => setSetCardListModalOpen(false)}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.75rem",
                background: "#e0e0e0",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.95rem",
                cursor: "pointer"
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* セットカード詳細モーダル */}
      {setCardDetailModalOpen && selectedSetCardInfo && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
          onClick={() => setSetCardDetailModalOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "300px"
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ 
              margin: "0 0 1rem 0", 
              fontSize: "1.1rem",
              textAlign: "center"
            }}>
              セットカード
            </h3>
            
            {/* カード画像（表向き） */}
            <div style={{
              width: "120px",
              aspectRatio: "0.7",
              margin: "0 auto 1rem",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
            }}>
              {selectedSetCardInfo.card.image ? (
                <img
                  src={URL.createObjectURL(selectedSetCardInfo.card.image)}
                  alt={selectedSetCardInfo.card.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
                  fontSize: "0.8rem",
                  padding: "0.5rem",
                  textAlign: "center"
                }}>
                  {selectedSetCardInfo.card.name}
                </div>
              )}
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {/* 裏向きの場合のみ「表に返す」を表示 */}
              {!selectedSetCardInfo.faceUp && (
                <button
                  onClick={handleFlipSetCard}
                  style={{
                    padding: "0.75rem",
                    background: "linear-gradient(135deg, #4caf50 0%, #388e3c 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  ↑ 表に返す
                </button>
              )}
              <button
                onClick={handleSetCardToRemove}
                style={{
                  padding: "0.75rem",
                  background: "linear-gradient(135deg, #ff5252 0%, #d32f2f 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  cursor: "pointer"
                }}
              >
                🗑️ リムーブへ送る
              </button>
              <button
                onClick={() => {
                  onCardDetailClick(selectedSetCardInfo.card);
                  setSetCardDetailModalOpen(false);
                }}
                style={{
                  padding: "0.75rem",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  cursor: "pointer"
                }}
              >
                🔍 詳細を見る
              </button>
              <button
                onClick={() => setSetCardDetailModalOpen(false)}
                style={{
                  padding: "0.75rem",
                  background: "#e0e0e0",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  cursor: "pointer"
                }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
