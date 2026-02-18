import { useState } from "react";
import type { Card } from "../../db";
import { HandArea } from "./areas/HandArea";
import { LeftSidePanel } from "./panels/LeftSidePanel";
import { RightSidePanel } from "./panels/RightSidePanel";

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

// カードサイズの定数（スマホ向けに小さく）
const CARD_WIDTH = 48;
const CARD_GAP = "0.2rem";

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

  return (
    <div style={{ 
      height: "100dvh", 
      display: "flex", 
      flexDirection: "column",
      overflow: "hidden",
      background: "#f5f5f5"
    }}>
      {/* ヘッダー - 高さを縮小 */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.25rem 0.5rem",
        background: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        zIndex: 10,
        flexShrink: 0
      }}>
        <h2 style={{ margin: 0, fontSize: "0.85rem", fontWeight: "bold" }}>
          🎮 P{currentPlayer}のターン
        </h2>
        <button className="btn-secondary" onClick={onReset} style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }}>
          🔙
        </button>
      </div>

      {/* 相手の現場（アコーディオン式） */}
      <div style={{ 
        background: "linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)",
        flexShrink: 0
      }}>
        {/* ヘッダー（タップで開閉） */}
        <div
          onClick={() => setIsOpponentFieldOpen(!isOpponentFieldOpen)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.4rem 0.75rem",
            background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
            color: "white",
            cursor: "pointer",
            userSelect: "none"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem" }}>👤</span>
            <span style={{ fontSize: "0.8rem", fontWeight: "bold" }}>相手の現場</span>
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
          maxHeight: isOpponentFieldOpen ? "200px" : "0",
          overflow: "hidden",
          transition: "max-height 0.3s ease"
        }}>
          <div style={{ 
            padding: "0.3rem",
            minHeight: 0
          }}>
            <div style={{ 
              background: "white",
              borderRadius: "6px",
              padding: "0.3rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
            }}>
              {opponentPlayerState.field.length === 0 ? (
                <div style={{
                  padding: "0.75rem",
                  textAlign: "center",
                  color: "#999",
                  fontSize: "0.8rem"
                }}>
                  現場にカードがありません
                </div>
              ) : (
                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: CARD_GAP,
                  alignContent: "flex-start"
                }}>
                  {opponentPlayerState.field.map((card, idx) => (
                    <div
                      key={`opponent-field-${card.id}-${idx}`}
                      style={{
                        width: `${CARD_WIDTH}px`,
                        aspectRatio: "0.7",
                        borderRadius: "3px",
                        overflow: "hidden",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        flexShrink: 0
                      }}
                    >
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
                          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: "0.5rem",
                          padding: "0.15rem",
                          textAlign: "center"
                        }}>
                          {card.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 中央コントロール */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.25rem",
        background: "white",
        borderTop: "1px solid #ddd",
        borderBottom: "1px solid #ddd",
        zIndex: 5,
        flexShrink: 0
      }}>
        <button
          className="btn-primary"
          onClick={() => setLeftPanelOpen(true)}
          style={{ padding: "0.4rem 0.7rem", fontSize: "1.1rem", lineHeight: 1 }}
        >
          ◀
        </button>
        <button
          className="btn-secondary"
          onClick={onSwitchPlayer}
          style={{ 
            padding: "0.4rem 0.7rem", 
            fontSize: "1.1rem",
            lineHeight: 1,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none"
          }}
        >
          🔄
        </button>
        <button
          className="btn-primary"
          onClick={() => setRightPanelOpen(true)}
          style={{ padding: "0.4rem 0.7rem", fontSize: "1.1rem", lineHeight: 1 }}
        >
          ▶
        </button>
      </div>

      {/* 自分の現場 */}
      <div style={{ 
        flex: 1,
        padding: "0.2rem",
        background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
        borderBottom: "1px solid #64b5f6",
        minHeight: 0,
        overflow: "hidden"
      }}>
        <div style={{ 
          height: "100%",
          background: "white",
          borderRadius: "6px",
          padding: "0.2rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ 
            fontSize: "0.7rem",
            fontWeight: "bold", 
            color: "#667eea",
            textAlign: "center",
            marginBottom: "0.15rem",
            flexShrink: 0
          }}>
            自分の現場
          </div>
          <div style={{
            flex: 1,
            display: "flex",
            flexWrap: "wrap",
            gap: CARD_GAP,
            overflow: "auto",
            alignContent: "flex-start"
          }}>
            {currentPlayerState.field.map((card, idx) => (
              <div
                key={`current-field-${card.id}-${idx}`}
                onClick={() => onCardClick(card, idx, "field")}
                style={{
                  width: `${CARD_WIDTH}px`,
                  aspectRatio: "0.7",
                  borderRadius: "3px",
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  cursor: "pointer",
                  flexShrink: 0
                }}
              >
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
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "0.5rem",
                    padding: "0.15rem",
                    textAlign: "center"
                  }}>
                    {card.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 自分の手札 */}
      <div style={{
        padding: "0.2rem",
        background: "linear-gradient(to top, #34495e 0%, #2c3e50 100%)",
        flexShrink: 0,
        height: "130px"
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
    </div>
  );
}
