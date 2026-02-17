import type { Card } from "../../../db";
import { colorMap } from "../../../shared/constants";

interface HandAreaProps {
  playHand: Card[];
  mulliganDone: boolean;
  onCardClick: (card: Card, index: number) => void;
  onStartMulligan: () => void;
}

export function HandArea({ playHand, mulliganDone, onCardClick, onStartMulligan }: HandAreaProps) {
  return (
    <div style={{
      background: "linear-gradient(to top, #34495e 0%, #2c3e50 100%)",
      borderRadius: "8px",
      padding: "0.5rem",
      border: "2px solid #1a252f",
      display: "flex",
      flexDirection: "column"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "0.5rem"
      }}>
        <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "white" }}>
          🃏 手札 ({playHand.length}枚)
        </div>
        {!mulliganDone && (
          <button
            className="btn-secondary"
            onClick={onStartMulligan}
            style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem" }}
          >
            🔄 マリガン
          </button>
        )}
      </div>
      <div style={{
        flex: 1,
        display: "flex",
        gap: "0.3rem",
        overflowX: "auto",
        overflowY: "hidden",
        alignItems: "flex-start"
      }}>
        {playHand.map((card, idx) => (
          <div
            key={`hand-${card.id}-${idx}`}
            onClick={() => onCardClick(card, idx)}
            style={{
              minWidth: "70px",
              width: "70px",
              aspectRatio: "0.7",
              borderRadius: "6px",
              overflow: "hidden",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              cursor: "pointer",
              transition: "transform 0.2s"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-10px)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
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
                background: `linear-gradient(135deg, ${colorMap[card.color ?? "黄"]} 0%, ${colorMap[card.color ?? "黄"]}dd 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                color: "white",
                padding: "0.25rem",
                fontSize: "0.6rem"
              }}>
                <div>Lv.{card.level}</div>
                <div style={{ fontWeight: "bold", textAlign: "center", fontSize: "0.65rem" }}>{card.name}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
