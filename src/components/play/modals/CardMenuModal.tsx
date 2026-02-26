import type { Card } from "../../../db";

interface CardMenuModalProps {
  show: boolean;
  selectedCard: { 
    card: Card; 
    index: number; 
    location: "hand" | "field" | "remove" | "evidence" | "file" 
  } | null;
  evidenceFaceUp: Set<number | undefined>;
  onAction: (action: "play" | "remove" | "evidence" | "view" | "toggleFace" | "move" | "setToField") => void;
  onClose: () => void;
  // セット先のカード一覧（現場のカード）
  fieldCards?: Card[];
}

export function CardMenuModal({ 
  show, 
  selectedCard, 
  evidenceFaceUp, 
  onAction, 
  onClose,
  fieldCards = []
}: CardMenuModalProps) {
  if (!show || !selectedCard) return null;

  return (
    <div 
      className="modal-overlay"
      onClick={onClose}
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
        zIndex: 1000
      }}
    >
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "1.5rem",
          maxWidth: "90%",
          width: "350px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.1rem", fontWeight: "bold" }}>
          {selectedCard.card.name}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {selectedCard.location === "hand" && (
            <>
              <button
                className="btn-primary"
                onClick={() => onAction("play")}
                style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
              >
                🎴 現場に出す
              </button>
              {/* セットして出すボタン（現場にカードがある場合のみ表示） */}
              {fieldCards.length > 0 && (
                <button
                  onClick={() => onAction("setToField")}
                  style={{ 
                    width: "100%", 
                    padding: "0.75rem", 
                    fontSize: "1rem",
                    background: "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  📥 セットして出す
                </button>
              )}
            </>
          )}
          {selectedCard.location === "field" && (
            <>
              <button
                className="btn-primary"
                onClick={() => onAction("remove")}
                style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
              >
                🗑️ リムーブ
              </button>
              <button
                className="btn-primary"
                onClick={() => onAction("evidence")}
                style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
              >
                📜 証拠にする
              </button>
            </>
          )}
          {selectedCard.location === "evidence" && (
            <>
              <button
                className="btn-primary"
                onClick={() => onAction("toggleFace")}
                style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
              >
                🔄 {evidenceFaceUp.has(selectedCard.card.id) ? "裏向きにする" : "表向きにする"}
              </button>
              <button
                className="btn-primary"
                onClick={() => onAction("move")}
                style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
              >
                ↔️ 移動する
              </button>
            </>
          )}
          {selectedCard.location === "file" && (
            <button
              className="btn-primary"
              onClick={() => onAction("move")}
              style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
            >
              ↔️ 移動する
            </button>
          )}
          <button
            className="btn-primary"
            onClick={() => onAction("view")}
            style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
          >
            🔍 拡大表示
          </button>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
          >
            ◀️ 閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
