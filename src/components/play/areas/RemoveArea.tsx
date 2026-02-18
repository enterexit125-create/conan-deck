import type { Card } from "../../../db";
import { colorMap } from "../../../shared/constants";

interface RemoveAreaProps {
  playRemove: Card[];
  onCardClick: (card: Card, index: number) => void;
}

// 統一カードサイズ
const CARD_WIDTH = 48;

export function RemoveArea({ playRemove, onCardClick }: RemoveAreaProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
      borderRadius: "6px",
      padding: "0.4rem",
      border: "1px solid #a93226",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      flex: 1
    }}>
      <div style={{ fontSize: "0.65rem", fontWeight: "bold", color: "white", marginBottom: "0.2rem" }}>
        リムーブ ({playRemove.length})
      </div>
      <div style={{
        flex: 1,
        width: "100%",
        overflow: "auto",
        display: "flex",
        flexWrap: "wrap",
        gap: "0.2rem",
        alignContent: "start"
      }}>
        {playRemove.map((card, idx) => (
          <div
            key={`remove-${card.id}-${idx}`}
            onClick={() => onCardClick(card, idx)}
            style={{
              width: `${CARD_WIDTH}px`,
              aspectRatio: "0.7",
              borderRadius: "4px",
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
                background: `linear-gradient(135deg, ${colorMap[card.color ?? "黄"]} 0%, ${colorMap[card.color ?? "黄"]}dd 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "0.45rem",
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
  );
}
