import type { Card } from "../../db";
import { colorMap } from "../../shared/constants";

interface CardDetailModalProps {
  show: boolean;
  card: Card | null;
  showRemoveButton?: boolean;
  onRemove?: (cardId: number) => void;
  onClose: () => void;
}

export function CardDetailModal({
  show,
  card,
  showRemoveButton = false,
  onRemove,
  onClose,
}: CardDetailModalProps) {
  if (!show || !card) return null;

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
        background: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem"
      }}
    >
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "1.5rem",
          maxWidth: "500px",
          width: "100%",
          maxHeight: "95vh",
          overflowY: "auto",
          position: "relative"
        }}
      >
        <style>{`
          @media (min-width: 768px) {
            .modal-content {
              max-width: 550px !important;
            }
          }
        `}</style>
        
        {/* 閉じるボタン（右上） */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            border: "2px solid #e0e0e0",
            background: "white",
            fontSize: "1.2rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#f5f5f5";
            e.currentTarget.style.borderColor = "#999";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "white";
            e.currentTarget.style.borderColor = "#e0e0e0";
          }}
        >
          ✕
        </button>

        {/* デッキから外すボタン（左上・パートナー/事件のみ） */}
        {showRemoveButton && (card.type === "パートナー" || card.type === "事件") && card.id && onRemove && (
          <button
            onClick={() => {
              if (confirm(`${card.name}をデッキから外しますか？`)) {
                onRemove(card.id!);
              }
            }}
            style={{
              position: "absolute",
              top: "1rem",
              left: "1rem",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "2px solid #ff8ab8",
              background: "#ffe0f0",
              fontSize: "1.2rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              zIndex: 10,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "#ff8ab8";
              e.currentTarget.style.borderColor = "#ff8ab8";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#ffe0f0";
              e.currentTarget.style.borderColor = "#ff8ab8";
            }}
            title="デッキから外す"
          >
            🗑️
          </button>
        )}

        {/* カード画像 */}
        <div 
          className="card-detail-image"
          style={{
            marginBottom: "1rem",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            maxWidth: "350px",
            margin: "0 auto 1rem auto"
          }}
        >
          <style>{`
            @media (min-width: 768px) {
              .card-detail-image {
                max-width: 450px !important;
              }
            }
          `}</style>
          {card.image ? (
            <img
              src={URL.createObjectURL(card.image)}
              alt={card.name}
              style={{
                width: "100%",
                height: "auto",
                display: "block"
              }}
            />
          ) : (
            <div style={{
              aspectRatio: "0.7",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "2rem"
            }}>
              🃏
            </div>
          )}
        </div>

        {/* カード情報 */}
        <div style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.75rem", color: "#333" }}>
            {card.name}
          </h2>
          
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            {card.number && (
              <span style={{
                padding: "0.25rem 0.75rem",
                background: "#e0e0e0",
                borderRadius: "12px",
                fontSize: "0.9rem",
                fontWeight: "bold"
              }}>
                No.{card.number}
              </span>
            )}
            {card.color && (
              <span style={{
                padding: "0.25rem 0.75rem",
                background: colorMap[card.color],
                color: "white",
                borderRadius: "12px",
                fontSize: "0.9rem",
                fontWeight: "bold"
              }}>
                {card.color}
              </span>
            )}
            {card.type && (
              <span style={{
                padding: "0.25rem 0.75rem",
                background: "#667eea",
                color: "white",
                borderRadius: "12px",
                fontSize: "0.9rem",
                fontWeight: "bold"
              }}>
                {card.type}
              </span>
            )}
            {card.level && (
              <span style={{
                padding: "0.25rem 0.75rem",
                background: "#f093fb",
                color: "white",
                borderRadius: "12px",
                fontSize: "0.9rem",
                fontWeight: "bold"
              }}>
                Lv.{card.level}
              </span>
            )}
          </div>

          {/* メモは非表示 */}
        </div>
      </div>
    </div>
  );
}
