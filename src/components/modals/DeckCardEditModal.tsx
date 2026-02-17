import type { Card } from "../../db";
import { colorMap } from "../../shared/constants";

interface DeckCardEditModalProps {
  editingDeckCard: { cardId: number; count: number } | null;
  cards: Card[];
  onIncrement: () => void;
  onDecrement: () => void;
  onClose: () => void;
}

export function DeckCardEditModal({
  editingDeckCard,
  cards,
  onIncrement,
  onDecrement,
  onClose,
}: DeckCardEditModalProps) {
  if (!editingDeckCard) return null;

  const card = cards.find(c => c.id === editingDeckCard.cardId);
  if (!card) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content deck-edit-modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: "350px", maxHeight: "90vh", overflowY: "auto" }}
      >
        <style>{`
          @media (min-width: 768px) {
            .deck-edit-modal {
              max-width: 600px !important;
            }
          }
        `}</style>
        
        <div className="modal-header">
          <span>枚数を変更</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div>
          {/* 枚数調整と完了ボタン（上部・一行） */}
          <div style={{
            padding: "0.75rem",
            background: "#ffe0f0",
            borderRadius: "12px",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem"
          }}>
            {/* 枚数調整 */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flex: 1
            }}>
              <button
                onClick={onDecrement}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  border: "2px solid #ff8ab8",
                  background: "white",
                  color: "#ff8ab8",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#ff8ab8";
                  e.currentTarget.style.color = "white";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "white";
                  e.currentTarget.style.color = "#ff8ab8";
                }}
              >
                −
              </button>
              <div style={{
                fontSize: "1.8rem",
                fontWeight: "bold",
                color: "#ff8ab8",
                minWidth: "50px",
                textAlign: "center"
              }}>
                ×{editingDeckCard.count}
              </div>
              <button
                onClick={onIncrement}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  border: "2px solid #ff8ab8",
                  background: "white",
                  color: "#ff8ab8",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#ff8ab8";
                  e.currentTarget.style.color = "white";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "white";
                  e.currentTarget.style.color = "#ff8ab8";
                }}
              >
                +
              </button>
            </div>

            {/* 完了ボタン */}
            <button
              onClick={onClose}
              style={{
                padding: "0.5rem 1.25rem",
                background: "white",
                color: "#ff8ab8",
                border: "2px solid #ff8ab8",
                borderRadius: "20px",
                fontSize: "1rem",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#ff8ab8";
                e.currentTarget.style.color = "white";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.color = "#ff8ab8";
              }}
            >
              完了
            </button>
          </div>

          {/* カード画像 */}
          <div 
            className="deck-card-image"
            style={{
              marginBottom: "1rem",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              maxWidth: "200px",
              margin: "0 auto 1rem auto"
            }}
          >
            <style>{`
              @media (min-width: 768px) {
                .deck-card-image {
                  max-width: 350px !important;
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
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ 
              fontSize: "1.5rem", 
              fontWeight: "bold", 
              marginBottom: "0.75rem", 
              color: "#333", 
              textAlign: "center" 
            }}>
              {card.name}
            </h2>
            
            <div style={{ 
              display: "flex", 
              gap: "0.5rem", 
              flexWrap: "wrap", 
              marginBottom: "0.75rem", 
              justifyContent: "center" 
            }}>
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
          </div>
        </div>
      </div>
    </div>
  );
}
