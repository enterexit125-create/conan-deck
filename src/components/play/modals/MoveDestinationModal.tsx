interface MoveDestinationModalProps {
  show: boolean;
  onMoveToField: () => void;
  onMoveToHand: () => void;
  onMoveToRemove: () => void;
  onMoveToDeck: () => void;
  onClose: () => void;
}

export function MoveDestinationModal({ 
  show, 
  onMoveToField, 
  onMoveToHand, 
  onMoveToRemove, 
  onMoveToDeck, 
  onClose 
}: MoveDestinationModalProps) {
  if (!show) return null;

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
        zIndex: 1001
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
          width: "400px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
        }}
      >
        <h3 style={{ marginBottom: "1rem", fontSize: "1.2rem", fontWeight: "bold" }}>移動先を選択</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <button
            className="btn-primary"
            onClick={onMoveToField}
            style={{
              width: "100%",
              padding: "1rem",
              fontSize: "1.1rem"
            }}
          >
            🎴 現場
          </button>
          <button
            className="btn-primary"
            onClick={onMoveToHand}
            style={{
              width: "100%",
              padding: "1rem",
              fontSize: "1.1rem"
            }}
          >
            🃏 手札
          </button>
          <button
            className="btn-primary"
            onClick={onMoveToRemove}
            style={{
              width: "100%",
              padding: "1rem",
              fontSize: "1.1rem"
            }}
          >
            🗑️ リムーブ
          </button>
          <button
            className="btn-primary"
            onClick={onMoveToDeck}
            style={{
              width: "100%",
              padding: "1rem",
              fontSize: "1.1rem"
            }}
          >
            🎴 山札（一番下）
          </button>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "1rem",
              fontSize: "1.1rem"
            }}
          >
            ◀️ 戻る
          </button>
        </div>
      </div>
    </div>
  );
}
