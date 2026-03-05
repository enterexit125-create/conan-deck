import type { Card } from "../../../db";
import { colorMap } from "../../../shared/constants";

interface HandAreaProps {
  playHand: Card[];
  mulliganDone: boolean;
  onCardClick: (card: Card, index: number) => void;
  onStartMulligan: () => void;
  onDrawCard: () => void;
  newMulliganCardIndices?: number[];
  onClearNewMulliganCards?: () => void;
  newHandCardIndices?: number[];
  onClearNewHandCards?: () => void;
}

// 手札カードサイズ（スマホ向けに縮小）
const HAND_CARD_WIDTH = 58;  // 70px → 58px

export function HandArea({ 
  playHand, 
  mulliganDone, 
  onCardClick, 
  onStartMulligan,
  onDrawCard,
  newMulliganCardIndices = [],
  onClearNewMulliganCards,
  newHandCardIndices = [],
  onClearNewHandCards
}: HandAreaProps) {
  
  // カードクリック時にハイライトをクリア
  const handleCardClick = (card: Card, index: number) => {
    if (newMulliganCardIndices.length > 0 && onClearNewMulliganCards) {
      onClearNewMulliganCards();
    }
    if (newHandCardIndices.length > 0 && onClearNewHandCards) {
      onClearNewHandCards();
    }
    onCardClick(card, index);
  };

  return (
    <div style={{
      height: "100%",
      background: "linear-gradient(to top, #34495e 0%, #2c3e50 100%)",
      borderRadius: "6px",
      padding: "0.3rem",  // 0.5rem → 0.3rem
      border: "1px solid #1a252f",  // 2px → 1px
      display: "flex",
      flexDirection: "column"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "0.3rem"  // 0.5rem → 0.3rem
      }}>
        <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "white" }}>
          🃏 手札 ({playHand.length}枚)
        </div>
        <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
          <button
            onClick={onDrawCard}
            style={{
              padding: "0.2rem 0.5rem",
              fontSize: "0.7rem",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            ＋ドロー
          </button>
          {!mulliganDone && (
            <button
              className="btn-secondary"
              onClick={onStartMulligan}
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}
            >
              🔄 マリガン
            </button>
          )}
        </div>
      </div>
      <div style={{
        flex: 1,
        display: "flex",
        gap: "0.25rem",  // 0.3rem → 0.25rem
        overflowX: "auto",
        overflowY: "hidden",
        alignItems: "flex-start"
      }}>
        {playHand.map((card, idx) => {
          const isNewFromMulligan = newMulliganCardIndices.includes(idx);
          const isNewFromDraw = newHandCardIndices.includes(idx);
          const isNew = isNewFromMulligan || isNewFromDraw;
          
          return (
            <div
              key={`hand-${card.id}-${idx}`}
              onClick={() => handleCardClick(card, idx)}
              style={{
                minWidth: `${HAND_CARD_WIDTH}px`,
                width: `${HAND_CARD_WIDTH}px`,
                aspectRatio: "0.7",
                borderRadius: "4px",
                overflow: "hidden",
                boxShadow: isNew 
                  ? "0 0 0 3px #ff4757, 0 0 12px #ff4757"
                  : "0 2px 4px rgba(0,0,0,0.3)",
                cursor: "pointer",
                transition: "transform 0.2s",
                position: "relative"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* NEWバッジ */}
              {isNew && (
                <div style={{
                  position: "absolute",
                  top: "2px",
                  left: "2px",
                  background: "#ff4757",
                  color: "white",
                  fontSize: "0.5rem",
                  fontWeight: "bold",
                  padding: "1px 4px",
                  borderRadius: "3px",
                  zIndex: 10,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
                }}>
                  NEW
                </div>
              )}
              
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
                  background: `linear-gradient(135deg, ${colorMap[card.color ?? "黄"]} 0%, ${colorMap[card.color ?? "黄"]}dd 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  color: "white",
                  padding: "0.2rem",
                  fontSize: "0.55rem"
                }}>
                  <div>Lv.{card.level}</div>
                  <div style={{ fontWeight: "bold", textAlign: "center", fontSize: "0.6rem" }}>{card.name}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
