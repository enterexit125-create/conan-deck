import type { Card } from "../../../db";
import { colorMap } from "../../../shared/constants";

interface CardDetailModalProps {
  show: boolean;
  card: Card | null;
  onClose: () => void;
}

export function CardDetailModal({ show, card, onClose }: CardDetailModalProps) {
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
        zIndex: 1001,
        padding: "1rem"
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90%",
          maxHeight: "90vh",
          overflow: "auto"
        }}
      >
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
          }}>
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
        <div style={{
          background: "white",
          borderRadius: "12px",
          padding: "1rem",
          maxWidth: "350px",
          margin: "0 auto"
        }}>
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

          <button
            className="btn-secondary"
            onClick={onClose}
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
