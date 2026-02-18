import type { Card } from "../../../db";
import { colorMap } from "../../../shared/constants";

interface FieldAreaProps {
  playField: Card[];
  onCardClick: (card: Card, index: number) => void;
}

export function FieldArea({ playField, onCardClick }: FieldAreaProps) {
  return (
    <div style={{
      flex: 1,
      background: "linear-gradient(135deg, #b0bec5 0%, #90a4ae 100%)",
      borderRadius: "8px",
      padding: "0.5rem",
      border: "2px solid #78909c",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column"
    }}>
      <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "white", marginBottom: "0.5rem", textAlign: "center" }}>
        現場
      </div>
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "0.3rem",
        overflow: "auto",
        alignContent: "start"
      }}>
        {playField.map((card, idx) => (
          <div
            key={`field-${card.id}-${idx}`}
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
