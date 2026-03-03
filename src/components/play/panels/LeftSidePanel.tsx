import type { Card } from "../../../db";
import { AccordionSection } from "./AccordionSection";
import cardBackImage from "/card-back.png";

interface LeftSidePanelProps {
  isOpen: boolean;
  playEvidence: Card[];
  playRemove: Card[];
  evidenceFaceUp: Set<number | undefined>;
  isEvidenceCollapsed: boolean;
  onToggleEvidenceCollapse: () => void;
  onEvidenceCardClick: (card: Card, index: number) => void;
  onRemoveCardClick: (card: Card, index: number) => void;
  onClose: () => void;
}

// カードサイズ定数
const CARD_WIDTH = 52;

export function LeftSidePanel({
  isOpen,
  playEvidence,
  playRemove,
  evidenceFaceUp,
  onEvidenceCardClick,
  onRemoveCardClick,
  onClose
}: LeftSidePanelProps) {
  return (
    <>
      {/* オーバーレイ */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 100
          }}
        />
      )}
      
      {/* パネル本体 */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "280px",
          background: "#f0f0f0",
          boxShadow: "2px 0 8px rgba(0,0,0,0.2)",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s ease",
          zIndex: 101,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto"
        }}
      >
        {/* ヘッダー */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.75rem",
          background: "white",
          borderBottom: "1px solid #ddd",
          position: "sticky",
          top: 0,
          zIndex: 1
        }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "bold" }}>📋 左エリア</h3>
          <button
            onClick={onClose}
            style={{
              background: "#e0e0e0",
              border: "none",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              fontSize: "1rem",
              cursor: "pointer",
              color: "#666",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            ✕
          </button>
        </div>

        {/* コンテンツ */}
        <div style={{ 
          padding: "0.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem"
        }}>
          {/* 証拠エリア */}
          <AccordionSection
            title="証拠"
            icon="🔍"
            count={playEvidence.length}
            defaultOpen={true}
            headerColor="#9c27b0"
          >
            {playEvidence.length === 0 ? (
              <div style={{
                padding: "1rem",
                textAlign: "center",
                color: "#999",
                fontSize: "0.8rem"
              }}>
                証拠カードはありません
              </div>
            ) : (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.3rem"
              }}>
                {playEvidence.map((card, idx) => {
                  const isFaceUp = evidenceFaceUp.has(card.id);
                  return (
                    <div
                      key={`evidence-${card.id}-${idx}`}
                      onClick={() => onEvidenceCardClick(card, idx)}
                      style={{
                        width: `${CARD_WIDTH}px`,
                        aspectRatio: "0.7",
                        borderRadius: "4px",
                        overflow: "hidden",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        cursor: "pointer",
                        position: "relative"
                      }}
                    >
                      {isFaceUp && card.image ? (
                        <img
                          src={URL.createObjectURL(card.image)}
                          alt={card.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <img
                          src={cardBackImage}
                          alt="裏向きカード"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      )}
                      {/* 番号バッジ */}
                      <div style={{
                        position: "absolute",
                        top: "2px",
                        left: "2px",
                        background: "rgba(0,0,0,0.7)",
                        color: "white",
                        fontSize: "0.6rem",
                        padding: "1px 4px",
                        borderRadius: "3px"
                      }}>
                        {idx + 1}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AccordionSection>

          {/* リムーブエリア */}
          <AccordionSection
            title="リムーブ"
            icon="🗑️"
            count={playRemove.length}
            defaultOpen={true}
            headerColor="#607d8b"
          >
            {playRemove.length === 0 ? (
              <div style={{
                padding: "1rem",
                textAlign: "center",
                color: "#999",
                fontSize: "0.8rem"
              }}>
                リムーブカードはありません
              </div>
            ) : (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.3rem"
              }}>
                {playRemove.map((card, idx) => (
                  <div
                    key={`remove-${card.id}-${idx}`}
                    onClick={() => onRemoveCardClick(card, idx)}
                    style={{
                      width: `${CARD_WIDTH}px`,
                      aspectRatio: "0.7",
                      borderRadius: "4px",
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      cursor: "pointer",
                      opacity: 0.8
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
                        background: "#9e9e9e",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "0.5rem",
                        padding: "0.1rem",
                        textAlign: "center"
                      }}>
                        {card.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </AccordionSection>
        </div>
      </div>
    </>
  );
}
