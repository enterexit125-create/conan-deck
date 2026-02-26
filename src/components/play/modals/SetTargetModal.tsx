import type { Card } from "../../../db";

interface SetTargetModalProps {
  show: boolean;
  fieldCards: Card[];
  onSelectTarget: (fieldIndex: number) => void;
  onClose: () => void;
}

export function SetTargetModal({
  show,
  fieldCards,
  onSelectTarget,
  onClose
}: SetTargetModalProps) {
  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem"
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "1.5rem",
          maxWidth: "90%",
          width: "400px",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "1.1rem", 
          fontWeight: "bold",
          color: "#ff9800",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }}>
          📥 セット先を選択
        </h3>
        
        <p style={{ 
          fontSize: "0.85rem", 
          color: "#666", 
          marginBottom: "1rem" 
        }}>
          どのカードの下にセットしますか？
        </p>

        {fieldCards.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            color: "#999", 
            padding: "2rem",
            background: "#f5f5f5",
            borderRadius: "8px"
          }}>
            現場にカードがありません
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.75rem"
          }}>
            {fieldCards.map((card, idx) => (
              <div
                key={`set-target-${card.id}-${idx}`}
                onClick={() => onSelectTarget(idx)}
                style={{
                  aspectRatio: "0.7",
                  borderRadius: "8px",
                  overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  border: "3px solid transparent",
                  position: "relative"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(255, 152, 0, 0.4)";
                  e.currentTarget.style.borderColor = "#ff9800";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
                  e.currentTarget.style.borderColor = "transparent";
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
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "0.7rem",
                    padding: "0.3rem",
                    textAlign: "center"
                  }}>
                    {card.name}
                  </div>
                )}
                {/* カード名オーバーレイ */}
                <div style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                  color: "white",
                  padding: "0.5rem 0.25rem 0.25rem",
                  fontSize: "0.65rem",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}>
                  {card.name}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: "1rem",
            padding: "0.75rem",
            fontSize: "1rem",
            background: "#e0e0e0",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer"
          }}
        >
          ◀️ キャンセル
        </button>
      </div>
    </div>
  );
}
