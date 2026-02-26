import { useState } from "react";
import type { Card } from "../../db";
import { HandArea } from "./areas/HandArea";
import { LeftSidePanel } from "./panels/LeftSidePanel";
import { RightSidePanel } from "./panels/RightSidePanel";
import { CardStatusBadge, CardStatusModal, type CardStatus, type CardState } from "./panels/CardStatusBadge";

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
  onReset: () => void;
  onCardClick: (card: Card, index: number, location: "hand" | "field" | "remove" | "evidence" | "file") => void;
  onCardDetailClick: (card: Card) => void;
  onToggleEvidenceCollapse: () => void;
  isEvidenceCollapsed: boolean;
}

// カードサイズの定数（スマホ向け・3枚横並び）
const CARD_WIDTH = 100;
const CARD_GAP = "0.3rem";

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
  onReset,
  onCardClick,
  onCardDetailClick,
  onToggleEvidenceCollapse,
  isEvidenceCollapsed
}: VersusPlayFieldProps) {
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  
  // 相手の現場の開閉状態
  const [isOpponentFieldOpen, setIsOpponentFieldOpen] = useState(true);

  // カードステータスの管理（キー: "プレイヤー-カードID-インデックス"）
  const [cardStatuses, setCardStatuses] = useState<Map<string, CardStatus>>(new Map());

  // カード状態の管理（アクティブ/スリープ/スタン）
  const [cardStates, setCardStates] = useState<Map<string, CardState>>(new Map());

  // ステータスモーダルの状態
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedCardForStatus, setSelectedCardForStatus] = useState<{
    card: Card;
    index: number;
    player: 1 | 2;
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

  return (
    <div style={{ 
      height: "100dvh", 
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
        flexShrink: 0,
        transition: "background 0.4s ease"
      }}>
        {/* ヘッダー（タップで開閉） */}
        <div
          onClick={() => setIsOpponentFieldOpen(!isOpponentFieldOpen)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.4rem 0.75rem",
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
          maxHeight: isOpponentFieldOpen ? "250px" : "0",
          overflow: "hidden",
          transition: "max-height 0.3s ease"
        }}>
          <div style={{ 
            padding: "0.2rem 0",
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
                  padding: "1rem", 
                  textAlign: "center", 
                  color: "#999",
                  fontSize: "0.85rem"
                }}>
                  カードなし
                </div>
              ) : (
                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: CARD_GAP,
                  padding: "0.3rem"
                }}>
                  {opponentPlayerState.field.map((card, idx) => {
                    const status = getCardStatus(card.id, idx, opponentPlayer);
                    const cardState = getCardState(card.id, idx, opponentPlayer);
                    const rotation = getCardRotation(cardState);
                    
                    return (
                      <div
                        key={`opponent-field-${card.id}-${idx}`}
                        onClick={() => handleCardTap(card, idx, opponentPlayer)}
                        style={{
                          width: `${CARD_WIDTH}px`,
                          aspectRatio: "0.7",
                          borderRadius: "4px",
                          overflow: "visible",
                          cursor: "pointer",
                          flexShrink: 0,
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
                              background: `linear-gradient(135deg, ${PLAYER_THEMES[opponentPlayer].primary} 0%, ${PLAYER_THEMES[opponentPlayer].secondary} 100%)`,
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
                          onTap={() => handleBadgeTap(card, idx, opponentPlayer)}
                        />
                      </div>
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
        gap: "0.5rem",
        padding: "0.4rem",
        background: "white",
        borderTop: "1px solid #ddd",
        borderBottom: "1px solid #ddd",
        zIndex: 5,
        flexShrink: 0
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
            transition: "background 0.4s ease"
          }}
        >
          ◀
        </button>
        
        {/* プレイヤー切り替えボタン - 大きく目立つように */}
        <button
          onClick={onSwitchPlayer}
          style={{ 
            padding: "0.5rem 1.2rem", 
            fontSize: "0.9rem",
            lineHeight: 1.2,
            background: currentPlayer === 1 
              ? "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)"
              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "3px solid white",
            borderRadius: "8px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            transition: "all 0.3s ease"
          }}
        >
          <span>🔄</span>
          <span style={{ fontWeight: "bold" }}>
            {currentPlayer === 1 ? "P2へ" : "P1へ"}
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
            transition: "background 0.4s ease"
          }}
        >
          ▶
        </button>
      </div>

      {/* 自分の現場 */}
      <div style={{ 
        flex: 1,
        padding: "0.2rem 0",
        background: theme.background,
        borderBottom: `1px solid ${theme.primary}`,
        minHeight: 0,
        overflow: "hidden",
        transition: "background 0.4s ease, border-color 0.4s ease"
      }}>
        <div style={{ 
          height: "100%",
          background: theme.fieldCardBg,
          borderRadius: "0",
          padding: "0.2rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          margin: "0 0.2rem",
          transition: "background 0.4s ease"
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
          <div style={{
            flex: 1,
            display: "flex",
            flexWrap: "wrap",
            gap: CARD_GAP,
            overflow: "auto",
            alignContent: "flex-start",
            padding: "0.3rem"
          }}>
            {currentPlayerState.field.map((card, idx) => {
              const status = getCardStatus(card.id, idx, currentPlayer);
              const cardState = getCardState(card.id, idx, currentPlayer);
              const rotation = getCardRotation(cardState);
              
              return (
                <div
                  key={`current-field-${card.id}-${idx}`}
                  onClick={() => handleCardTap(card, idx, currentPlayer)}
                  style={{
                    width: `${CARD_WIDTH}px`,
                    aspectRatio: "0.7",
                    borderRadius: "4px",
                    overflow: "visible",
                    cursor: "pointer",
                    flexShrink: 0,
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
                        background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
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
                    onTap={() => handleBadgeTap(card, idx, currentPlayer)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 自分の手札 - プレイヤーに応じて色が変わる */}
      <div style={{
        padding: "0.2rem",
        background: theme.handBg,
        flexShrink: 0,
        height: "130px",
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
    </div>
  );
}
