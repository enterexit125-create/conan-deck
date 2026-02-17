import { useState } from "react";
import type { Deck } from "../../db";

interface DeckSelectScreenProps {
  decks: Deck[];
  onSelectDecks: (player1DeckId: number, player2DeckId: number) => void;
  onCreateDeck: () => void;
}

export function DeckSelectScreen({ decks, onSelectDecks, onCreateDeck }: DeckSelectScreenProps) {
  const [player1DeckId, setPlayer1DeckId] = useState<number | null>(null);
  const [player2DeckId, setPlayer2DeckId] = useState<number | null>(null);

  function handleStart() {
    if (player1DeckId === null || player2DeckId === null) {
      alert("両方のデッキを選択してください");
      return;
    }
    onSelectDecks(player1DeckId, player2DeckId);
  }

  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">🎮 一人回し（対戦モード）</h2>
      </div>
      <div className="info-panel">
        <div className="info-panel-title">デッキを選択してください</div>
        <div className="info-panel-text">
          プレイヤー1とプレイヤー2のデッキを選んでください。各デッキは40枚である必要があります。
        </div>
      </div>
      
      {decks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎴</div>
          <div>デッキがありません</div>
          <div style={{ marginTop: "1rem" }}>
            <button className="btn-primary" onClick={onCreateDeck}>
              ➕ 新しいデッキを作成
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* プレイヤー1のデッキ選択 */}
          <div style={{ marginTop: "1.5rem" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "1rem", color: "#667eea" }}>
              👤 プレイヤー1のデッキ
            </h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: "1rem"
            }}>
              {decks.map((deck) => {
                const isSelected = deck.id === player1DeckId;
                return (
                  <div
                    key={`p1-${deck.id}`}
                    onClick={() => setPlayer1DeckId(deck.id!)}
                    style={{
                      padding: "1.5rem",
                      background: isSelected 
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "linear-gradient(135deg, #e0e0e0 0%, #c0c0c0 100%)",
                      borderRadius: "12px",
                      cursor: "pointer",
                      color: isSelected ? "white" : "#333",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      boxShadow: isSelected 
                        ? "0 8px 20px rgba(102, 126, 234, 0.4)" 
                        : "0 4px 12px rgba(0,0,0,0.15)",
                      border: isSelected ? "3px solid #fff" : "3px solid transparent"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        border: `2px solid ${isSelected ? "white" : "#666"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isSelected ? "white" : "transparent"
                      }}>
                        {isSelected && <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#667eea" }} />}
                      </div>
                      <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>
                        {deck.name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* プレイヤー2のデッキ選択 */}
          <div style={{ marginTop: "2rem" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "1rem", color: "#e74c3c" }}>
              👤 プレイヤー2のデッキ
            </h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: "1rem"
            }}>
              {decks.map((deck) => {
                const isSelected = deck.id === player2DeckId;
                return (
                  <div
                    key={`p2-${deck.id}`}
                    onClick={() => setPlayer2DeckId(deck.id!)}
                    style={{
                      padding: "1.5rem",
                      background: isSelected 
                        ? "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)"
                        : "linear-gradient(135deg, #e0e0e0 0%, #c0c0c0 100%)",
                      borderRadius: "12px",
                      cursor: "pointer",
                      color: isSelected ? "white" : "#333",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      boxShadow: isSelected 
                        ? "0 8px 20px rgba(231, 76, 60, 0.4)" 
                        : "0 4px 12px rgba(0,0,0,0.15)",
                      border: isSelected ? "3px solid #fff" : "3px solid transparent"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        border: `2px solid ${isSelected ? "white" : "#666"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isSelected ? "white" : "transparent"
                      }}>
                        {isSelected && <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#e74c3c" }} />}
                      </div>
                      <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>
                        {deck.name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 開始ボタン */}
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <button
              className="btn-primary"
              onClick={handleStart}
              disabled={player1DeckId === null || player2DeckId === null}
              style={{
                padding: "1rem 3rem",
                fontSize: "1.2rem",
                opacity: (player1DeckId === null || player2DeckId === null) ? 0.5 : 1,
                cursor: (player1DeckId === null || player2DeckId === null) ? "not-allowed" : "pointer"
              }}
            >
              ⚔️ 対戦開始
            </button>
          </div>
        </>
      )}
    </div>
  );
}
