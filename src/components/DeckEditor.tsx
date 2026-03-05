import type { Card, Deck, DeckCard } from "../db";
import { colorMap, TARGET_DECK_SIZE } from "../shared/constants";

interface DeckEditorProps {
  activeDeck: Deck | undefined;
  totalInDeck: number;
  partnerCard: Card | null | undefined;
  incidentCard: Card | null | undefined;
  characterCount: number;
  eventCount: number;
  levelDistribution: Record<string, number>;
  maxLevelCount: number;
  cardsByLevel: Record<string, Array<{ card: Card; count: number }>>;
  deckCards: DeckCard[];
  cards: Card[];
  deckCardMap: Map<number, DeckCard>;
  
  openCardDetail: (card: Card) => void;
  openCardSelectModal: (filter: "all" | "partner" | "incident") => void;
  openEditDeckCard: (cardId: number) => void;
  removeCardFromDeck: (cardId: number) => Promise<void>;
  createDeck: () => Promise<void>;
  renameDeck: (deckId: number) => Promise<void>;
}

export function DeckEditor({
  activeDeck,
  totalInDeck,
  partnerCard,
  incidentCard,
  characterCount,
  eventCount,
  levelDistribution,
  maxLevelCount,
  deckCards,
  cards,
  openCardDetail,
  openCardSelectModal,
  openEditDeckCard,
  removeCardFromDeck,
  createDeck,
  renameDeck,
}: DeckEditorProps) {
  if (!activeDeck) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🎴</div>
        <div>デッキを選択してください</div>
        <div style={{ marginTop: "1rem" }}>
          <button className="btn-primary" onClick={createDeck}>➕ 新しいデッキを作成</button>
        </div>
      </div>
    );
  }

  // パートナーと事件を除いたデッキカード
  const mainDeckCards = deckCards.filter(dc => {
    const card = cards.find(c => c.id === dc.cardId);
    return card && card.type !== "パートナー" && card.type !== "事件";
  });

  return (
    <div style={{ marginTop: "-1.5rem" }}>
      {/* デッキ完成メッセージ */}
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

      {/* デッキ名 + 変更ボタン */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        marginBottom: "0.75rem",
        padding: "0 0.25rem"
      }}>
        <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#333" }}>
          {activeDeck.name}
        </span>
        <button
          className="btn-secondary"
          style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}
          onClick={() => renameDeck(activeDeck.id!)}
        >
          ✏️ 名前を変更
        </button>
      </div>
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

      {/* ヘッダー: パートナー、事件、統計情報 */}
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
          {/* パートナー */}
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

          {/* 事件 */}
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
                <div style={{ fontSize: "1.5rem", opacity: 0.3 }}>📋</div>
              )}
            </div>
            {incidentCard && <div style={{ fontSize: "0.65rem", color: "#999", textAlign: "center", maxWidth: "98px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{incidentCard.name}</div>}
          </div>

          {/* 統計情報 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 0 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.25rem 0.5rem",
              background: "#f5f7fa",
              borderRadius: "6px"
            }}>
              <span style={{ fontSize: "0.75rem", color: "#666" }}>デッキ枚数</span>
              <span style={{ 
                fontSize: "0.9rem", 
                fontWeight: "bold",
                color: totalInDeck === TARGET_DECK_SIZE ? "#4caf50" : totalInDeck > TARGET_DECK_SIZE ? "#f44336" : "#666"
              }}>
                {totalInDeck}/{TARGET_DECK_SIZE}
              </span>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.25rem 0.5rem",
              background: "#fff3e0",
              borderRadius: "6px"
            }}>
              <span style={{ fontSize: "0.75rem", color: "#666" }}>キャラ</span>
              <span style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#666" }}>{characterCount}</span>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.25rem 0.5rem",
              background: "#e3f2fd",
              borderRadius: "6px"
            }}>
              <span style={{ fontSize: "0.75rem", color: "#666" }}>イベント</span>
              <span style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#666" }}>{eventCount}</span>
            </div>
          </div>
        </div>

        {/* レベル分布グラフ */}
        <div style={{ marginTop: "0.75rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#666", marginBottom: "0.25rem" }}>レベル分布</div>
          <div style={{ 
            display: "flex", 
            gap: "2px", 
            alignItems: "flex-end", 
            height: "40px",
            background: "#f5f7fa",
            padding: "0.25rem",
            borderRadius: "6px"
          }}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((level) => {
              const count = levelDistribution[level] || 0;
              const heightPercent = maxLevelCount > 0 ? (count / maxLevelCount) * 100 : 0;
              
              return (
                <div 
                  key={level} 
                  style={{ 
                    flex: 1, 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center",
                    gap: "2px"
                  }}
                >
                  <div style={{
                    width: "100%",
                    height: `${heightPercent}%`,
                    background: count > 0 ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "#e0e0e0",
                    borderRadius: "2px",
                    minHeight: count > 0 ? "4px" : "2px",
                    transition: "all 0.3s"
                  }} />
                  <span style={{ fontSize: "0.6rem", color: "#999" }}>{level}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* デッキ内カード（横並び） */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">デッキ内カード</h2>
          <button className="btn-secondary" onClick={() => openCardSelectModal("all")}>➕</button>
        </div>

        {mainDeckCards.length > 0 ? (
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem"
          }}>
            {mainDeckCards.map((dc) => {
              const card = cards.find(c => c.id === dc.cardId);
              if (!card) return null;

              return (
                <div key={dc.id} style={{
                  position: "relative",
                  width: "80px",
                  flexShrink: 0
                }}>
                  {/* カード画像 */}
                  <div 
                    onClick={() => openCardDetail(card)}
                    style={{
                      width: "80px",
                      height: "112px",
                      borderRadius: "6px",
                      overflow: "hidden",
                      cursor: "pointer",
                      position: "relative",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                    }}
                  >
                    {card.image ? (
                      <img src={URL.createObjectURL(card.image)} alt={card.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🎴</div>
                    )}
                    {/* 枚数バッジ */}
                    <div style={{
                      position: "absolute",
                      bottom: "4px",
                      right: "4px",
                      background: "rgba(0,0,0,0.8)",
                      color: "white",
                      borderRadius: "50%",
                      width: "24px",
                      height: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      fontWeight: "bold"
                    }}>
                      ×{dc.count}
                    </div>
                  </div>
                  {/* カード名 */}
                  <div style={{
                    fontSize: "0.7rem",
                    marginTop: "0.25rem",
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>
                    {card.name}
                  </div>
                  {/* カード番号 */}
                  <div style={{
                    fontSize: "0.65rem",
                    textAlign: "center",
                    color: "#999"
                  }}>
                    {card.number || "---"}/{card.type === "キャラ" ? "キ" : "イ"}
                  </div>
                  {/* 操作ボタン */}
                  <div style={{ display: "flex", gap: "2px", marginTop: "0.25rem" }}>
                    <button 
                      className="btn-secondary" 
                      style={{ flex: 1, padding: "0.25rem", fontSize: "0.7rem" }}
                      onClick={() => openEditDeckCard(card.id!)}
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn-danger" 
                      style={{ flex: 1, padding: "0.25rem", fontSize: "0.7rem" }}
                      onClick={() => removeCardFromDeck(card.id!)}
                    >
                      ➖
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🎴</div>
            <div>デッキにカードがありません</div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>「カード追加」ボタンからカードを追加してください</div>
          </div>
        )}
      </div>
    </div>
  );
}
