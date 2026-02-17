import type { Card } from "../../../db";
import { colorMap } from "../../../shared/constants";

interface MulliganModalProps {
  show: boolean;
  playHand: Card[];
  selectedForMulligan: number[];
  onToggleSelect: (index: number) => void;
  onExecute: () => void;
  onCancel: () => void;
}

export function MulliganModal({ 
  show, 
  playHand, 
  selectedForMulligan, 
  onToggleSelect, 
  onExecute, 
  onCancel 
}: MulliganModalProps) {
  if (!show) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "1rem"
    }}>
      <div style={{
        background: "white",
        borderRadius: "12px",
        padding: "1.5rem",
        maxWidth: "90%",
        maxHeight: "90vh",
        overflow: "auto"
      }}>
        <h3 style={{ marginTop: 0, textAlign: "center" }}>🔄 マリガン</h3>
        <p style={{ textAlign: "center", color: "#666", marginBottom: "1rem" }}>
          山札に戻すカードを選択（最大5枚）
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
          gap: "0.5rem",
          marginBottom: "1rem"
        }}>
          {playHand.map((card, idx) => {
            const isSelected = selectedForMulligan.includes(idx);
            return (
              <div
                key={`mulligan-${card.id}-${idx}`}
                onClick={() => onToggleSelect(idx)}
                style={{
                  borderRadius: "8px",
                  overflow: "hidden",
                  border: isSelected ? "3px solid #fbc02d" : "3px solid transparent",
                  cursor: "pointer",
                  position: "relative",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ aspectRatio: "0.7" }}>
                  {card.image ? (
                    <img
                      src={URL.createObjectURL(card.image)}
                      alt={card.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", opacity: isSelected ? 0.7 : 1 }}
                    />
                  ) : (
                    <div style={{
                      width: "100%",
                      height: "100%",
                      background: `linear-gradient(135deg, ${colorMap[card.color ?? "黄"]} 0%, ${colorMap[card.color ?? "黄"]}dd 100%)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "0.7rem",
                      fontWeight: "bold",
                      padding: "0.25rem",
                      opacity: isSelected ? 0.7 : 1
                    }}>
                      {card.name}
                    </div>
                  )}
                  {isSelected && (
                    <div style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      background: "#fbc02d",
                      color: "white",
                      borderRadius: "50%",
                      width: "40px",
                      height: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                      fontWeight: "bold"
                    }}>
                      ✓
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-secondary" onClick={onCancel} style={{ flex: 1 }}>
            キャンセル
          </button>
          <button className="btn-primary" onClick={onExecute} style={{ flex: 1 }}>
            マリガン実行 ({selectedForMulligan.length}枚)
          </button>
        </div>
      </div>
    </div>
  );
}
