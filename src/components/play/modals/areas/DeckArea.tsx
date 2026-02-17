import cardBackImage from "/card-back.png";

interface DeckAreaProps {
  deckCount: number;
  onDrawCard: () => void;
  onStartTurn: () => void;
}

// 統一カードサイズ
const CARD_WIDTH = 48;

export function DeckArea({ deckCount, onDrawCard, onStartTurn }: DeckAreaProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
      borderRadius: "6px",
      padding: "0.4rem",
      border: "1px solid #2471a3",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <div style={{ fontSize: "0.65rem", fontWeight: "bold", color: "white", marginBottom: "0.2rem" }}>
        山札
      </div>
      <div 
        onClick={onDrawCard}
        style={{
          width: `${CARD_WIDTH}px`,
          aspectRatio: "0.7",
          borderRadius: "4px",
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
          bottom: "0.15rem",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "0.1rem 0.3rem",
          borderRadius: "3px",
          fontSize: "0.6rem",
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
          marginTop: "0.2rem",
          padding: "0.25rem",
          fontSize: "0.6rem"
        }}
      >
        手番開始
      </button>
    </div>
  );
}
