import type { Card } from "../../../db";

interface IncidentAreaProps {
  incidentCard: Card | null;
  onCardClick: (card: Card) => void;
}

// 統一カードサイズ
const CARD_WIDTH = 48;

export function IncidentArea({ incidentCard, onCardClick }: IncidentAreaProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #e67e22 0%, #f39c12 100%)",
      borderRadius: "6px",
      padding: "0.4rem",
      border: "1px solid #d35400",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <div style={{ fontSize: "0.65rem", fontWeight: "bold", color: "white", marginBottom: "0.2rem" }}>
        事件
      </div>
      <div 
        onClick={() => {
          if (incidentCard) {
            onCardClick(incidentCard);
          }
        }}
        style={{
          width: `${CARD_WIDTH}px`,
          aspectRatio: "0.7",
          borderRadius: "4px",
          overflow: "hidden",
          background: "rgba(255,255,255,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: incidentCard ? "pointer" : "default"
        }}
      >
        {incidentCard?.image ? (
          <img
            src={URL.createObjectURL(incidentCard.image)}
            alt={incidentCard.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ color: "white", fontSize: "0.55rem", textAlign: "center" }}>
            {incidentCard?.name || "なし"}
          </div>
        )}
      </div>
    </div>
  );
}
