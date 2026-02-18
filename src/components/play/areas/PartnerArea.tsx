import type { Card } from "../../../db";

interface PartnerAreaProps {
  partnerCard: Card | null;
  onCardClick: (card: Card) => void;
}

// 統一カードサイズ
const CARD_WIDTH = 48;

export function PartnerArea({ partnerCard, onCardClick }: PartnerAreaProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #16a085 0%, #1abc9c 100%)",
      borderRadius: "6px",
      padding: "0.4rem",
      border: "1px solid #138d75",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <div style={{ fontSize: "0.65rem", fontWeight: "bold", color: "white", marginBottom: "0.2rem" }}>
        パートナー
      </div>
      <div 
        onClick={() => {
          if (partnerCard) {
            onCardClick(partnerCard);
          }
        }}
        style={{
          width: `${CARD_WIDTH}px`,
          aspectRatio: "0.7",
          borderRadius: "4px",
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
            fontSize: "0.55rem",
            textAlign: "center"
          }}>
            {partnerCard?.name || "なし"}
          </div>
        )}
      </div>
    </div>
  );
}
