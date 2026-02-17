import type { Card } from "../../../db";
import cardBackImage from "/card-back.png";

interface FileAreaProps {
  playFile: Card[];
  onCardClick: (card: Card, index: number) => void;
}

export function FileArea({ playFile, onCardClick }: FileAreaProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
      borderRadius: "8px",
      padding: "0.5rem",
      border: "2px solid #d68910",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "white", marginBottom: "0.25rem" }}>
        FILE ({playFile.length})
      </div>
      <div style={{
        width: "100%",
        maxHeight: "150px",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem"
      }}>
        {playFile.map((card, idx) => (
          <div
            key={`file-${card.id}-${idx}`}
            onClick={() => onCardClick(card, idx)}
            style={{
              aspectRatio: "0.7",
              borderRadius: "6px",
              overflow: "hidden",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              cursor: "pointer"
            }}
          >
            <img
              src={cardBackImage}
              alt="file card"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
