import cardBackImage from "/card-back.png";

interface DeckAreaProps {
  deckCount: number;
  onDrawCard: () => void;
  onStartTurn: () => void;
}

export function DeckArea({ deckCount, onDrawCard, onStartTurn }: DeckAreaProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
      borderRadius: "8px",
      padding: "0.5rem",
      border: "2px solid #2471a3",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "white", marginBottom: "0.25rem" }}>
        山札
      </div>
      <div 
        onClick={onDrawCard}
        style={{
          width: "100%",
          aspectRatio: "0.7",
          borderRadius: "6px",
          overflow: "hidden",
          background: "rgba(255,255,255,0.2)",
          cursor: "pointer",
          position: "relative"
        }}
      >
        <img
          src={cardBackImage}
          alt="deck"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{
          position: "absolute",
          bottom: "0.25rem",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "0.2rem 0.4rem",
          borderRadius: "4px",
          fontSize: "0.7rem",
          fontWeight: "bold"
        }}>
          {deckCount}枚
        </div>
      </div>
      <button
        className="btn-secondary"
        onClick={onStartTurn}
        style={{
          width: "100%",
          marginTop: "0.25rem",
          padding: "0.3rem",
          fontSize: "0.65rem"
        }}
      >
        手番開始
      </button>
    </div>
  );
}
