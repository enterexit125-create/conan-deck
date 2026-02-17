import type { Card } from "../../../db";
import { colorMap } from "../../../shared/constants";

interface RemoveAreaProps {
  playRemove: Card[];
  onCardClick: (card: Card, index: number) => void;
}

export function RemoveArea({ playRemove, onCardClick }: RemoveAreaProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
      borderRadius: "8px",
      padding: "0.5rem",
      border: "2px solid #a93226",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      flex: 1
    }}>
      <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "white", marginBottom: "0.25rem" }}>
        リムーブ ({playRemove.length})
      </div>
      <div style={{
        flex: 1,
        width: "100%",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem"
      }}>
        {playRemove.map((card, idx) => (
          <div
            key={`remove-${card.id}-${idx}`}
            onClick={() => onCardClick(card, idx)}
            style={{
              aspectRatio: "0.7",
              borderRadius: "6px",
              overflow: "hidden",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
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
                background: `linear-gradient(135deg, ${colorMap[card.color ?? "黄"]} 0%, ${colorMap[card.color ?? "黄"]}dd 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "0.5rem",
                padding: "0.2rem",
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
