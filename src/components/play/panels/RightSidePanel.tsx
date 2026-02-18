import type { Card } from "../../../db";
import { AccordionSection } from "./AccordionSection";

interface RightSidePanelProps {
  isOpen: boolean;
  deckCount: number;
  playFile: Card[];
  partnerCard: Card | null;
  incidentCard: Card | null;
  onDrawCard: () => void;
  onStartTurn: () => void;
  onFileCardClick: (card: Card, index: number) => void;
  onPartnerClick: (card: Card) => void;
  onIncidentClick: (card: Card) => void;
  onClose: () => void;
}

// カードサイズ定数
const CARD_WIDTH = 52;

export function RightSidePanel({
  isOpen,
  deckCount,
  playFile,
  partnerCard,
  incidentCard,
  onDrawCard,
  onStartTurn,
  onFileCardClick,
  onPartnerClick,
  onIncidentClick,
  onClose
}: RightSidePanelProps) {
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
          right: 0,
          bottom: 0,
          width: "280px",
          background: "#f0f0f0",
          boxShadow: "-2px 0 8px rgba(0,0,0,0.2)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
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
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "bold" }}>📋 右エリア</h3>
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
          {/* 山札エリア */}
          <AccordionSection
            title="山札"
            icon="📚"
            count={deckCount}
            defaultOpen={true}
            headerColor="#2196f3"
          >
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "0.25rem"
            }}>
              {/* 山札表示 */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem"
              }}>
                <div style={{
                  width: "50px",
                  height: "70px",
                  background: "linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                }}>
                  <span style={{ color: "white", fontSize: "1.2rem", fontWeight: "bold" }}>
                    {deckCount}
                  </span>
                </div>
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "0.3rem",
                  flex: 1 
                }}>
                  <button
                    onClick={onDrawCard}
                    style={{
                      padding: "0.5rem",
                      background: "linear-gradient(135deg, #4caf50 0%, #388e3c 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    🃏 ドロー
                  </button>
                  <button
                    onClick={onStartTurn}
                    style={{
                      padding: "0.5rem",
                      background: "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    ⏩ 手番開始
                  </button>
                </div>
              </div>
            </div>
          </AccordionSection>

          {/* FILEエリア */}
          <AccordionSection
            title="FILE"
            icon="📁"
            count={playFile.length}
            defaultOpen={true}
            headerColor="#ff5722"
          >
            {playFile.length === 0 ? (
              <div style={{
                padding: "1rem",
                textAlign: "center",
                color: "#999",
                fontSize: "0.8rem"
              }}>
                FILEカードはありません
              </div>
            ) : (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.3rem"
              }}>
                {playFile.map((card, idx) => (
                  <div
                    key={`file-${card.id}-${idx}`}
                    onClick={() => onFileCardClick(card, idx)}
                    style={{
                      width: `${CARD_WIDTH}px`,
                      aspectRatio: "0.7",
                      borderRadius: "4px",
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      cursor: "pointer"
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
                        background: "linear-gradient(135deg, #ff5722 0%, #e64a19 100%)",
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

          {/* パートナーエリア */}
          <AccordionSection
            title="パートナー"
            icon="👤"
            defaultOpen={false}
            headerColor="#e91e63"
          >
            <div style={{
              display: "flex",
              justifyContent: "center",
              padding: "0.5rem"
            }}>
              {partnerCard ? (
                <div
                  onClick={() => onPartnerClick(partnerCard)}
                  style={{
                    width: "70px",
                    height: "98px",
                    borderRadius: "6px",
                    overflow: "hidden",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    cursor: "pointer"
                  }}
                >
                  {partnerCard.image ? (
                    <img
                      src={URL.createObjectURL(partnerCard.image)}
                      alt={partnerCard.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{
                      width: "100%",
                      height: "100%",
                      background: "linear-gradient(135deg, #e91e63 0%, #c2185b 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "0.6rem",
                      padding: "0.2rem",
                      textAlign: "center"
                    }}>
                      {partnerCard.name}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: "1rem",
                  textAlign: "center",
                  color: "#999",
                  fontSize: "0.8rem"
                }}>
                  パートナー未設定
                </div>
              )}
            </div>
          </AccordionSection>

          {/* 事件エリア */}
          <AccordionSection
            title="事件"
            icon="📋"
            defaultOpen={false}
            headerColor="#795548"
          >
            <div style={{
              display: "flex",
              justifyContent: "center",
              padding: "0.5rem"
            }}>
              {incidentCard ? (
                <div
                  onClick={() => onIncidentClick(incidentCard)}
                  style={{
                    width: "98px",
                    height: "70px",
                    borderRadius: "6px",
                    overflow: "hidden",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    cursor: "pointer"
                  }}
                >
                  {incidentCard.image ? (
                    <img
                      src={URL.createObjectURL(incidentCard.image)}
                      alt={incidentCard.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{
                      width: "100%",
                      height: "100%",
                      background: "linear-gradient(135deg, #795548 0%, #5d4037 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "0.6rem",
                      padding: "0.2rem",
                      textAlign: "center"
                    }}>
                      {incidentCard.name}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: "1rem",
                  textAlign: "center",
                  color: "#999",
                  fontSize: "0.8rem"
                }}>
                  事件カード未設定
                </div>
              )}
            </div>
          </AccordionSection>
        </div>
      </div>
    </>
  );
}
