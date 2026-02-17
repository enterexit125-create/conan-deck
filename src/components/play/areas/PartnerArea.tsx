import type { Card } from "../../../db";

interface PartnerAreaProps {
  partnerCard: Card | null;
  onCardClick: (card: Card) => void;
}

export function PartnerArea({ partnerCard, onCardClick }: PartnerAreaProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #16a085 0%, #1abc9c 100%)",
      borderRadius: "8px",
      padding: "0.5rem",
      border: "2px solid #138d75",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "white", marginBottom: "0.25rem" }}>
        パートナー
      </div>
      <div 
        onClick={() => {
          if (partnerCard) {
            onCardClick(partnerCard);
          }
        }}
        style={{
          width: "100%",
          aspectRatio: "0.7",
          borderRadius: "6px",
          overflow: "hidden",
          background: "rgba(255,255,255,0.2)",
          cursor: partnerCard ? "pointer" : "default"
        }}
      >
        {partnerCard?.image ? (
          <img
            src={URL.createObjectURL(partnerCard.image)}
            alt={partnerCard.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "0.7rem",
            textAlign: "center"
          }}>
            {partnerCard?.name || "なし"}
          </div>
        )}
      </div>
    </div>
  );
}
