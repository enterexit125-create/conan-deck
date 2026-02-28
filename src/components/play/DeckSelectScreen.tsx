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
  
  // モーダル表示状態（1: P1選択中, 2: P2選択中, null: 閉じてる）
  const [selectingPlayer, setSelectingPlayer] = useState<1 | 2 | null>(null);
  
  // 検索クエリ
  const [searchQuery, setSearchQuery] = useState("");

  // 選択されたデッキの情報を取得
  const player1Deck = decks.find(d => d.id === player1DeckId);
  const player2Deck = decks.find(d => d.id === player2DeckId);
  
  // 検索でフィルタリングされたデッキ
  const filteredDecks = decks.filter(deck => 
    deck.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // デッキ選択処理
  function selectDeck(deckId: number) {
    if (selectingPlayer === 1) {
      setPlayer1DeckId(deckId);
    } else if (selectingPlayer === 2) {
      setPlayer2DeckId(deckId);
    }
    setSelectingPlayer(null);
    setSearchQuery(""); // 検索をリセット
  }
  
  // モーダルを開く
  function openModal(player: 1 | 2) {
    setSearchQuery(""); // 検索をリセット
    setSelectingPlayer(player);
  }

  // ゲーム開始
  function handleStart() {
    if (player1DeckId === null || player2DeckId === null) {
      alert("両方のデッキを選択してください");
      return;
    }
    onSelectDecks(player1DeckId, player2DeckId);
  }

  // デッキがない場合
  if (decks.length === 0) {
    return (
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">🎮 一人回し</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">🎴</div>
          <div>デッキがありません</div>
          <div style={{ marginTop: "1rem" }}>
            <button className="btn-primary" onClick={onCreateDeck}>
              ➕ 新しいデッキを作成
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      {/* ヘッダー */}
      <div style={{
        textAlign: "center",
        padding: "1.5rem",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        borderRadius: "12px",
        color: "white",
        marginBottom: "1.5rem"
      }}>
        <h2 style={{ margin: 0, fontSize: "1.4rem" }}>🎮 一人回しモード</h2>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", opacity: 0.9 }}>
          2つのデッキを選んで対戦練習
        </p>
      </div>

      {/* デッキ選択ボタン */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        
        {/* プレイヤー1選択ボタン */}
        <button
          onClick={() => openModal(1)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.2rem 1.5rem",
            background: player1Deck 
              ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              : "white",
            color: player1Deck ? "white" : "#333",
            border: player1Deck ? "none" : "2px dashed #667eea",
            borderRadius: "12px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: "bold",
            boxShadow: player1Deck 
              ? "0 4px 12px rgba(102, 126, 234, 0.3)"
              : "none",
            transition: "all 0.2s"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🔵</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>プレイヤー1</div>
              <div style={{ fontSize: "1.1rem" }}>
                {player1Deck ? player1Deck.name : "タップしてデッキを選択"}
              </div>
            </div>
          </div>
          <span style={{ fontSize: "1.2rem" }}>▶</span>
        </button>

        {/* VS表示 */}
        <div style={{
          textAlign: "center",
          fontSize: "1.3rem",
          fontWeight: "bold",
          color: "#999",
          padding: "0.5rem"
        }}>
          ⚔️ VS ⚔️
        </div>

        {/* プレイヤー2選択ボタン */}
        <button
          onClick={() => openModal(2)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.2rem 1.5rem",
            background: player2Deck 
              ? "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)"
              : "white",
            color: player2Deck ? "white" : "#333",
            border: player2Deck ? "none" : "2px dashed #e74c3c",
            borderRadius: "12px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: "bold",
            boxShadow: player2Deck 
              ? "0 4px 12px rgba(231, 76, 60, 0.3)"
              : "none",
            transition: "all 0.2s"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🔴</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>プレイヤー2</div>
              <div style={{ fontSize: "1.1rem" }}>
                {player2Deck ? player2Deck.name : "タップしてデッキを選択"}
              </div>
            </div>
          </div>
          <span style={{ fontSize: "1.2rem" }}>▶</span>
        </button>
      </div>

      {/* 開始ボタン */}
      <button
        onClick={handleStart}
        disabled={player1DeckId === null || player2DeckId === null}
        style={{
          width: "100%",
          marginTop: "2rem",
          padding: "1.2rem",
          fontSize: "1.2rem",
          fontWeight: "bold",
          background: (player1DeckId !== null && player2DeckId !== null)
            ? "linear-gradient(135deg, #4caf50 0%, #388e3c 100%)"
            : "#ccc",
          color: "white",
          border: "none",
          borderRadius: "12px",
          cursor: (player1DeckId !== null && player2DeckId !== null) 
            ? "pointer" 
            : "not-allowed",
          boxShadow: (player1DeckId !== null && player2DeckId !== null)
            ? "0 4px 12px rgba(76, 175, 80, 0.4)"
            : "none",
          transition: "all 0.3s"
        }}
      >
        ▶️ 対戦開始
      </button>

      {/* デッキ選択モーダル */}
      {selectingPlayer !== null && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 1000,
            padding: "0"
          }}
          onClick={() => setSelectingPlayer(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxHeight: "80vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              animation: "slideUp 0.3s ease-out"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div style={{
              padding: "1.25rem",
              borderBottom: "1px solid #e0e0e0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: selectingPlayer === 1 
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
              color: "white"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.3rem" }}>
                  {selectingPlayer === 1 ? "🔵" : "🔴"}
                </span>
                <span style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
                  プレイヤー{selectingPlayer}のデッキを選択
                </span>
              </div>
              <button
                onClick={() => setSelectingPlayer(null)}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  color: "white",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ✕
              </button>
            </div>

            {/* 検索バー */}
            <div style={{
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #e0e0e0",
              background: "#f9f9f9"
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                background: "white",
                borderRadius: "8px",
                border: "2px solid #e0e0e0",
                padding: "0.5rem 0.75rem",
                gap: "0.5rem"
              }}>
                <span style={{ fontSize: "1rem", color: "#999" }}>🔍</span>
                <input
                  type="text"
                  placeholder="デッキ名で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    fontSize: "1rem",
                    background: "transparent"
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      background: "#e0e0e0",
                      border: "none",
                      borderRadius: "50%",
                      width: "24px",
                      height: "24px",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#666"
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* デッキ一覧 */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: "1rem"
            }}>
              {filteredDecks.length === 0 ? (
                <div style={{
                  textAlign: "center",
                  padding: "2rem",
                  color: "#999"
                }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔍</div>
                  <div>「{searchQuery}」に一致するデッキがありません</div>
                </div>
              ) : (
                filteredDecks.map((deck) => {
                const isSelected = selectingPlayer === 1 
                  ? deck.id === player1DeckId 
                  : deck.id === player2DeckId;
                const isOtherPlayerSelected = selectingPlayer === 1
                  ? deck.id === player2DeckId
                  : deck.id === player1DeckId;
                
                return (
                  <button
                    key={deck.id}
                    onClick={() => selectDeck(deck.id!)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "1rem 1.25rem",
                      marginBottom: "0.75rem",
                      background: isSelected 
                        ? (selectingPlayer === 1 
                            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                            : "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)")
                        : "#f5f5f5",
                      color: isSelected ? "white" : "#333",
                      border: "none",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontSize: "1rem",
                      fontWeight: "600",
                      textAlign: "left",
                      transition: "all 0.2s",
                      boxShadow: isSelected 
                        ? "0 4px 12px rgba(0,0,0,0.2)"
                        : "0 2px 4px rgba(0,0,0,0.05)",
                      opacity: isOtherPlayerSelected ? 0.5 : 1
                    }}
                  >
                    {/* チェックマーク */}
                    <div style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: isSelected 
                        ? "2px solid white" 
                        : "2px solid #ccc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isSelected ? "white" : "transparent",
                      flexShrink: 0
                    }}>
                      {isSelected && (
                        <span style={{ 
                          color: selectingPlayer === 1 ? "#667eea" : "#e74c3c",
                          fontSize: "1rem",
                          fontWeight: "bold"
                        }}>✓</span>
                      )}
                    </div>

                    {/* デッキ名 */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "1.1rem" }}>{deck.name}</div>
                      {isOtherPlayerSelected && (
                        <div style={{ 
                          fontSize: "0.8rem", 
                          opacity: 0.7,
                          marginTop: "0.25rem"
                        }}>
                          {selectingPlayer === 1 ? "P2が選択中" : "P1が選択中"}
                        </div>
                      )}
                    </div>

                    {/* 矢印 */}
                    <span style={{ 
                      fontSize: "1.2rem", 
                      opacity: 0.5 
                    }}>▶</span>
                  </button>
                );
              })
              )}
            </div>
          </div>
        </div>
      )}

      {/* アニメーション用CSS */}
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
