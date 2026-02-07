import { useMemo } from "react";
import type { Deck, Card, DeckCard } from "../db";
import Thumb from "../shared/Thumb";
import { COLOR_OPTIONS, LEVEL_OPTIONS, TARGET_DECK_SIZE, colorMap } from "../shared/constants";

interface DeckEditorProps {
  activeDeck: Deck;
  cards: Card[];
  deckCards: DeckCard[];
  totalInDeck: number;
  partnerCard: Card | null;
  incidentCard: Card | null;
  characterCount: number;
  eventCount: number;
  levelDistribution: Record<string, number>;
  maxLevelCount: number;
  openCardDetail: (card: Card) => void;
  openCardSelectModal: (filter: "all" | "partner" | "incident") => void;
  openEditDeckCard: (cardId: number) => void;
  renameActiveDeck: () => Promise<void>;
}

export default function DeckEditor({
  activeDeck,
  cards,
  deckCards,
  totalInDeck,
  partnerCard,
  incidentCard,
  characterCount,
  eventCount,
  levelDistribution,
  maxLevelCount,
  openCardDetail,
  openCardSelectModal,
  openEditDeckCard,
  renameActiveDeck
}: DeckEditorProps) {
  const cardsByLevel = useMemo(() => {
    const grouped: Record<string, Array<{ card: Card; count: number }>> = {};
    LEVEL_OPTIONS.forEach(level => {
      grouped[level] = [];
    });

    deckCards.forEach(dc => {
      const card = cards.find(c => c.id === dc.cardId);
      if (card && card.type !== "パートナー" && card.type !== "事件" && card.level) {
        grouped[card.level].push({ card, count: dc.count });
      }
    });

    return grouped;
  }, [deckCards, cards]);

  return (
    <>
      {totalInDeck === TARGET_DECK_SIZE && (
        <div style={{ 
          padding: "0.75rem", 
          marginBottom: "1rem", 
          background: "linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%)",
          borderRadius: "12px",
          textAlign: "center",
          fontSize: "1rem",
          fontWeight: "bold",
          color: "#1b5e20",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          ✅ 40枚のデッキが完成しました！
        </div>
      )}

      <div style={{
        background: "white",
        border: "2px solid #e0e0e0",
        borderRadius: "12px",
        padding: "0.75rem",
        marginBottom: "1rem",
        maxWidth: "600px",
        margin: "0 auto 1rem auto"
      }}>
        <div style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "0.75rem",
          alignItems: "flex-start"
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#666" }}>パートナー</div>
            <div style={{
              width: "70px",
              height: "98px",
              borderRadius: "6px",
              overflow: "hidden",
              border: "2px solid #e0e0e0",
              background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }} onClick={() => {
              if (partnerCard) {
                openCardDetail(partnerCard);
              } else {
                openCardSelectModal("partner");
              }
            }}>
              {partnerCard?.image ? (
                <img src={URL.createObjectURL(partnerCard.image)} alt={partnerCard.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ fontSize: "1.5rem", opacity: 0.3 }}>🃏</div>
              )}
            </div>
            {partnerCard && <div style={{ fontSize: "0.65rem", color: "#999", textAlign: "center", maxWidth: "70px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{partnerCard.name}</div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#666" }}>事件</div>
            <div style={{
              width: "98px",
              height: "70px",
              borderRadius: "6px",
              overflow: "hidden",
              border: "2px solid #e0e0e0",
              background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }} onClick={() => {
              if (incidentCard) {
                openCardDetail(incidentCard);
              } else {
                openCardSelectModal("incident");
              }
            }}>
            {incidentCard?.image ? (
              <img src={URL.createObjectURL(incidentCard.image)} alt={incidentCard.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ fontSize: "1.5rem", opacity: 0.3 }}>🃏</div>
            )}
          </div>
          {incidentCard && <div style={{ fontSize: "0.65rem", color: "#999", textAlign: "center", maxWidth: "98px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{incidentCard.name}</div>}
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ fontSize: "0.95rem", fontWeight: "bold", color: "#d4716b", flex: 1 }}>
                {activeDeck.name}
              </div>
              <button className="btn-secondary" style={{ padding: "0.3rem 0.5rem", fontSize: "0.9rem" }} onClick={renameActiveDeck}>✏️</button>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ fontSize: "0.8rem" }}>
                <span style={{ color: "#666" }}>キャラ:</span> <strong style={{ fontSize: "0.9rem", color: "#667eea" }}>{characterCount}</strong>
              </div>
              <div style={{ fontSize: "0.8rem" }}>
                <span style={{ color: "#666" }}>イベント:</span> <strong style={{ fontSize: "0.9rem", color: "#ff9a9e" }}>{eventCount}</strong>
              </div>
              <div style={{ fontSize: "0.8rem" }}>
                <span style={{ color: "#666" }}>デッキ:</span> <strong style={{ fontSize: "0.9rem", color: totalInDeck === TARGET_DECK_SIZE ? "#43a047" : "#333" }}>{totalInDeck}/{TARGET_DECK_SIZE}</strong>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#666" }}>レベル分布</div>
          <div style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "0.2rem",
            height: "60px",
            padding: "0.4rem",
            background: "linear-gradient(135deg, #fff0f3 0%, #ffe4e8 100%)",
            borderRadius: "6px",
            border: "2px solid #ffd4dc"
          }}>
            {LEVEL_OPTIONS.map((level) => {
              const count = levelDistribution[level] || 0;
              const height = maxLevelCount > 0 ? (count / maxLevelCount) * 40 : 0;
              
              return (
                <div key={level} style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.15rem",
                  flex: 1
                }}>
                  <div style={{
                    fontSize: "0.6rem",
                    fontWeight: "bold",
                    color: count > 0 ? "#ff9a9e" : "#ccc",
                    minHeight: "0.8rem"
                  }}>
                    {count > 0 ? count : ""}
                  </div>
                  <div style={{
                    width: "100%",
                    height: `${height}px`,
                    background: count > 0 ? "linear-gradient(180deg, #ff9a9e 0%, #fad0c4 100%)" : "#e0e0e0",
                    borderRadius: "3px 3px 0 0",
                    transition: "all 0.3s ease",
                    minHeight: "3px"
                  }} />
                  <div style={{
                    fontSize: "0.65rem",
                    fontWeight: "bold",
                    color: "#666"
                  }}>
                    {level}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2 className="section-title">デッキ内カード</h2>
          <button className="btn-primary" onClick={() => openCardSelectModal("all")}>➕</button>
        </div>
        {deckCards.filter(dc => {
          const card = cards.find(c => c.id === dc.cardId);
          return card?.type !== "パートナー" && card?.type !== "事件";
        }).length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div>デッキにカードがありません</div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
            gap: "0.5rem",
            padding: "0.5rem 0"
          }}>
            {LEVEL_OPTIONS.flatMap((level) => 
              cardsByLevel[level].map(({ card, count }) => (
                <div
                  key={card.id}
                  className="card-item"
                  onClick={() => openEditDeckCard(card.id!)}
                  style={{ cursor: "pointer" }}
                >
                  {card.color && <div className="card-color-badge" style={{ background: colorMap[card.color] || "#9e9e9e" }} />}
                  <Thumb blob={card.image} alt={card.name ?? "card"} size="small" />
                  <div className="card-name" style={{ fontSize: "0.75rem" }}>{card.name}</div>
                  <div className="card-number" style={{ fontSize: "0.7rem" }}>
                    {card.number || "---"}/{card.level}
                  </div>
                  <div style={{
                    position: "absolute",
                    top: "8px",
                    left: "8px",
                    background: "rgba(102, 126, 234, 0.9)",
                    color: "white",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "12px",
                    fontSize: "0.8rem",
                    fontWeight: "bold"
                  }}>
                    ×{count}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}