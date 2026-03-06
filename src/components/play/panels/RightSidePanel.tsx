import type { Card } from "../../../db";
import { AccordionSection } from "./AccordionSection";
import cardBackImage from "/card-back.png";

interface RightSidePanelProps {
  isOpen: boolean;
  deckCount: number;
  playFile: Card[];
  partnerCard: Card | null;
  partnerZone: Card[];
  partnerState: "normal" | "reasoning" | "assist";
  incidentCard: Card | null;
  opponentTraceFound: boolean;
  incidentPhase: "incident" | "resolution"; // 事件編 or 解決編
  onDrawCard: () => void;
  onRefreshDeck: () => void;
  onFileCardClick: (card: Card, index: number) => void;
  onPartnerClick: (card: Card) => void;
  onPartnerZoneCardClick: (card: Card, index: number) => void;
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
  partnerZone,
  partnerState,
  incidentCard,
  opponentTraceFound,
  incidentPhase,
  onDrawCard,
  onRefreshDeck,
  onFileCardClick,
  onPartnerClick,
  onPartnerZoneCardClick,
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
                {/* カード裏面 + 枚数バッジ */}
                <div style={{
                  width: "60px",
                  height: "84px",
                  borderRadius: "4px",
                  overflow: "hidden",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  position: "relative",
                  flexShrink: 0
                }}>
                  <img
                    src={cardBackImage}
                    alt="山札"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  {/* 枚数バッジ */}
                  <div style={{
                    position: "absolute",
                    bottom: "4px",
                    right: "4px",
                    background: "rgba(0,0,0,0.7)",
                    color: "white",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    padding: "2px 6px",
                    borderRadius: "4px"
                  }}>
                    {deckCount}
                  </div>
                </div>
                
                {/* ドローボタン */}
                <button
                  onClick={onDrawCard}
                  disabled={deckCount === 0}
                  style={{
                    padding: "0.5rem",
                    background: deckCount === 0 
                      ? "#ccc" 
                      : "linear-gradient(135deg, #4caf50 0%, #388e3c 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    fontWeight: "bold",
                    cursor: deckCount === 0 ? "not-allowed" : "pointer",
                    opacity: deckCount === 0 ? 0.6 : 1
                  }}
                >
                  🃏 ドロー
                </button>
                
                {/* リフレッシュボタン（山札0枚時のみ表示） */}
                {deckCount === 0 && (
                  <button
                    onClick={onRefreshDeck}
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
                    🔄 リフレッシュ
                  </button>
                )}
              </div>
              
              {/* 痕跡発見済みメッセージ */}
              {opponentTraceFound && (
                <div style={{
                  marginTop: "0.5rem",
                  padding: "0.4rem 0.6rem",
                  background: "linear-gradient(135deg, #ff5722 0%, #e64a19 100%)",
                  color: "white",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: "bold",
                  textAlign: "center"
                }}>
                  🔍 痕跡発見済み
                </div>
              )}
            </div>
          </AccordionSection>

          {/* FILEエリア */}
          <AccordionSection
            title="FILE"
            icon="📁"
            count={playFile.length + (partnerState === "assist" && partnerCard ? 1 : 0)}
            defaultOpen={true}
            headerColor="#ff5722"
          >
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.3rem"
            }}>
              {/* アシスト時のパートナーカード */}
              {partnerState === "assist" && partnerCard && (
                <div
                  onClick={() => onPartnerClick(partnerCard)}
                  style={{
                    width: "73px",
                    height: "52px",
                    borderRadius: "4px",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    cursor: "pointer",
                    border: "2px solid #e91e63",
                    position: "relative"
                  }}
                >
                  {partnerCard.image ? (
                    <img
                      src={URL.createObjectURL(partnerCard.image)}
                      alt={partnerCard.name}
                      style={{ 
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        width: "52px",
                        height: "73px",
                        objectFit: "cover",
                        transform: "translate(-50%, -50%) rotate(90deg)"
                      }}
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
                      fontSize: "0.5rem",
                      padding: "0.1rem",
                      textAlign: "center"
                    }}>
                      {partnerCard.name}
                    </div>
                  )}
                  {/* Pバッジ */}
                  <div style={{
                    position: "absolute",
                    top: "2px",
                    right: "2px",
                    background: "#e91e63",
                    color: "white",
                    fontSize: "0.6rem",
                    fontWeight: "bold",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1
                  }}>
                    P
                  </div>
                </div>
              )}
              
              {/* 通常のFILEカード（裏向き） */}
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
                  <img
                    src={cardBackImage}
                    alt="裏向きカード"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ))}
              
              {/* FILEもアシストパートナーもない場合 */}
              {playFile.length === 0 && !(partnerState === "assist" && partnerCard) && (
                <div style={{
                  padding: "1rem",
                  textAlign: "center",
                  color: "#999",
                  fontSize: "0.8rem",
                  width: "100%"
                }}>
                  FILEカードはありません
                </div>
              )}
            </div>
          </AccordionSection>

          {/* パートナーエリア */}
          <AccordionSection
            title="パートナー"
            icon="👤"
            defaultOpen={true}
            headerColor="#e91e63"
          >
            <div style={{
              display: "flex",
              gap: "0.75rem",
              padding: "0.5rem",
              alignItems: "flex-start"
            }}>
              {/* デッキのパートナーカード */}
              {partnerCard && (
                <div style={{ textAlign: "center" }}>
                  {(partnerState === "reasoning" || partnerState === "assist") && (
                    <div style={{ 
                      fontSize: "0.65rem", 
                      color: "#666", 
                      marginBottom: "0.2rem" 
                    }}>
                      {partnerState === "reasoning" && "🔄"}
                      {partnerState === "assist" && "🅿️"}
                    </div>
                  )}
                  <div
                    onClick={() => onPartnerClick(partnerCard)}
                    style={{
                      width: (partnerState === "reasoning" || partnerState === "assist") ? "84px" : "60px",
                      height: (partnerState === "reasoning" || partnerState === "assist") ? "60px" : "84px",
                      borderRadius: "4px",
                      overflow: "hidden",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                      cursor: "pointer",
                      border: partnerState !== "normal" ? "2px solid #4caf50" : "none",
                      position: "relative"
                    }}
                  >
                    {partnerCard.image ? (
                      <img
                        src={URL.createObjectURL(partnerCard.image)}
                        alt={partnerCard.name}
                        style={{ 
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          width: (partnerState === "reasoning" || partnerState === "assist") ? "60px" : "100%",
                          height: (partnerState === "reasoning" || partnerState === "assist") ? "84px" : "100%",
                          objectFit: "cover",
                          transform: (partnerState === "reasoning" || partnerState === "assist") 
                            ? "translate(-50%, -50%) rotate(90deg)" 
                            : "translate(-50%, -50%)"
                        }}
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
                        fontSize: "0.55rem",
                        padding: "0.2rem",
                        textAlign: "center"
                      }}>
                        {partnerCard.name}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* パートナーゾーンに置かれたカード */}
              {partnerZone.length > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ 
                    fontSize: "0.65rem", 
                    color: "#666", 
                    marginBottom: "0.2rem" 
                  }}>
                    ゾーン
                  </div>
                  <div
                    onClick={() => onPartnerZoneCardClick(partnerZone[0], 0)}
                    style={{
                      width: "60px",
                      height: "84px",
                      borderRadius: "4px",
                      overflow: "hidden",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                      cursor: "pointer",
                      border: "2px solid #e91e63"
                    }}
                  >
                    {partnerZone[0].image ? (
                      <img
                        src={URL.createObjectURL(partnerZone[0].image)}
                        alt={partnerZone[0].name}
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
                        fontSize: "0.55rem",
                        padding: "0.2rem",
                        textAlign: "center"
                      }}>
                        {partnerZone[0].name}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* パートナーもパートナーゾーンも空の場合 */}
              {!partnerCard && partnerZone.length === 0 && (
                <div style={{
                  padding: "1rem",
                  textAlign: "center",
                  color: "#999",
                  fontSize: "0.8rem",
                  width: "100%"
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
            defaultOpen={true}
            headerColor="#795548"
          >
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "0.5rem",
              gap: "0.5rem"
            }}>
              {/* 解決編バッジ（左側） */}
              {incidentPhase === "resolution" && (
                <div style={{
                  background: "linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)",
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  padding: "0.4rem 0.6rem",
                  borderRadius: "6px",
                  letterSpacing: "0.1em",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                  flexShrink: 0,
                  whiteSpace: "nowrap"
                }}>
                  解決編
                </div>
              )}

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

              {/* 事件編バッジ（右側） */}
              {incidentPhase === "incident" && (
                <div style={{
                  background: "linear-gradient(135deg, #795548 0%, #5d4037 100%)",
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  padding: "0.4rem 0.6rem",
                  borderRadius: "6px",
                  letterSpacing: "0.1em",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                  flexShrink: 0,
                  whiteSpace: "nowrap"
                }}>
                  事件編
                </div>
              )}
            </div>
          </AccordionSection>
        </div>
      </div>
    </>
  );
}
