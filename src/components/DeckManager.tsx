import type { Card, Deck, DeckCard } from "../db";
import { colorMap, COLOR_OPTIONS } from "../shared/constants";

interface DeckManagerProps {
  decks: Deck[];
  activeDeckId: number | null;
  cards: Card[];
  deckCards: DeckCard[];
  createDeck: () => Promise<void>;
  renameDeck: (deckId: number) => Promise<void>;
  deleteDeck: (deckId: number) => Promise<void>;
  setActiveDeckId: (id: number) => void;
  switchTab: (tab: "cards" | "decks" | "editor" | "play" | "sync") => void;
}

export function DeckManager({
  decks,
  activeDeckId,
  cards,
  deckCards,
  createDeck,
  renameDeck,
  deleteDeck,
  setActiveDeckId,
  switchTab,
}: DeckManagerProps) {
  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">デッキ管理</h2>
        <button className="btn-primary" onClick={createDeck}>➕</button>
      </div>
      <div className="deck-list">
        {decks.map((d) => {
          // 選択中のデッキの色分布を計算
          let colorDistribution: Record<string, number> = {};
          if (d.id === activeDeckId) {
            deckCards.forEach(dc => {
              const card = cards.find(c => c.id === dc.cardId);
              if (card?.color && card.type !== "パートナー" && card.type !== "事件") {
                colorDistribution[card.color] = (colorDistribution[card.color] || 0) + dc.count;
              }
            });
          }
          
          return (
            <div 
              key={d.id} 
              className={`deck-chip ${d.id === activeDeckId ? "active" : ""}`} 
              onClick={() => { setActiveDeckId(d.id!); switchTab("editor"); }} 
              onDoubleClick={() => renameDeck(d.id!)} 
              title="クリックで選択・ダブルクリックでリネーム"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                padding: "0.75rem",
                cursor: "pointer"
              }}
            >
              {/* デッキ名 */}
              <span style={{ fontWeight: "bold", fontSize: "1rem" }}>{d.name}</span>
              
              {/* 色分布（選択中のデッキのみ） */}
              {d.id === activeDeckId && (
                <div style={{
                  display: "flex",
                  gap: "1px",
                  height: "12px",
                  minWidth: "60px",
                  maxWidth: "100px",
                  flex: 1,
                  borderRadius: "3px",
                  overflow: "hidden",
                  border: "1px solid #e0e0e0"
                }}>
                  {COLOR_OPTIONS.map((color) => {
                    const count = colorDistribution[color] || 0;
                    const total = Object.values(colorDistribution).reduce((sum, c) => sum + c, 0);
                    const widthPercent = total > 0 ? (count / total) * 100 : 0;
                    
                    if (count === 0) return null;
                    
                    return (
                      <div 
                        key={color} 
                        style={{
                          height: "100%",
                          width: `${widthPercent}%`,
                          background: colorMap[color],
                          minWidth: "3px"
                        }}
                        title={`${color}: ${count}枚`}
                      />
                    );
                  })}
                </div>
              )}
              
              {/* 削除ボタン */}
              <button 
                className="deck-delete-btn" 
                onClick={(e) => { e.stopPropagation(); deleteDeck(d.id!); }} 
                title="削除"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
