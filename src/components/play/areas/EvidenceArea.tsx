import type { Card } from "../../../db";
import cardBackImage from "/card-back.png";
import { colorMap } from "../../../shared/constants";

interface EvidenceAreaProps {
  playEvidence: Card[];
  evidenceFaceUp: Set<number | undefined>;
  isEvidenceCollapsed: boolean;
  onToggleCollapse: () => void;
  onCardClick: (card: Card, index: number) => void;
}

export function EvidenceArea({ 
  playEvidence, 
  evidenceFaceUp, 
  isEvidenceCollapsed, 
  onToggleCollapse,
  onCardClick 
}: EvidenceAreaProps) {
  return (
    <div style={{
      flex: 1,
      background: "linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)",
      borderRadius: "8px",
      padding: "0.5rem",
      border: "2px solid #6c3483",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "0.25rem"
      }}>
        <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "white" }}>
          証拠 ({playEvidence.length})
        </div>
        <button
          onClick={onToggleCollapse}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "white",
            borderRadius: "4px",
            padding: "0.1rem 0.3rem",
            fontSize: "0.7rem",
            cursor: "pointer"
          }}
        >
          {isEvidenceCollapsed ? "▼" : "▲"}
        </button>
      </div>
      {!isEvidenceCollapsed && (
        <div style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "0.25rem",
          overflow: "auto",
          alignContent: "start"
        }}>
          {playEvidence.map((card, idx) => {
            const isFaceUp = evidenceFaceUp.has(card.id);
            return (
              <div
                key={`evidence-${card.id}-${idx}`}
                onClick={() => onCardClick(card, idx)}
                style={{
                  aspectRatio: "0.7",
                  borderRadius: "6px",
                  overflow: "hidden",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  cursor: "pointer",
                  position: "relative"
                }}
              >
                {isFaceUp ? (
                  card.image ? (
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
                      padding: "0.25rem",
                      textAlign: "center"
                    }}>
                      {card.name}
                    </div>
                  )
                ) : (
                  <div style={{ position: "relative", width: "100%", height: "100%" }}>
                    <img
                      src={cardBackImage}
                      alt="card back"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
