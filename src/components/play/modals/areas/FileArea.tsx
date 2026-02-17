import type { Card } from "../../../db";
import cardBackImage from "/card-back.png";

interface FileAreaProps {
  playFile: Card[];
  onCardClick: (card: Card, index: number) => void;
}

// 統一カードサイズ
const CARD_WIDTH = 48;

export function FileArea({ playFile, onCardClick }: FileAreaProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
      borderRadius: "6px",
      padding: "0.4rem",
      border: "1px solid #d68910",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <div style={{ fontSize: "0.65rem", fontWeight: "bold", color: "white", marginBottom: "0.2rem" }}>
        FILE ({playFile.length})
      </div>
      <div style={{
        width: "100%",
        maxHeight: "120px",
        overflow: "auto",
        display: "flex",
        flexWrap: "wrap",
        gap: "0.2rem",
        justifyContent: "center"
      }}>
        {playFile.map((card, idx) => (
          <div
            key={`file-${card.id}-${idx}`}
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
