import { useMemo, useState } from "react";
import type { Card, DeckCard } from "../../db";
import Thumb from "../../shared/Thumb";
import { colorMap, COLOR_OPTIONS, LEVEL_OPTIONS } from "../../shared/constants";

interface CardSelectModalProps {
  show: boolean;
  filter: "all" | "partner" | "incident";
  cards: Card[];
  deckCardMap: Map<number, DeckCard>;
  onSelectCard: (cardId: number) => void;
  onClose: () => void;
}

export function CardSelectModal({
  show,
  filter,
  cards,
  deckCardMap,
  onSelectCard,
  onClose,
}: CardSelectModalProps) {
  const [search, setSearch] = useState("");
  const [filterColor, setFilterColor] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const num = (c.number ?? "").toLowerCase();
      const matchText = !q || name.includes(q) || num.includes(q);
      const matchColor = !filterColor || c.color === filterColor;
      const matchType = !filterType || c.type === filterType;
      const matchLevel = !filterLevel || c.level === parseInt(filterLevel);
      
      // フィルターに応じてタイプをチェック
      if (filter === "partner" && c.type !== "パートナー") return false;
      if (filter === "incident" && c.type !== "事件") return false;
      
      return matchText && matchColor && matchType && matchLevel;
    });
  }, [cards, search, filterColor, filterType, filterLevel, filter]);

  if (!show) return null;

  const getTitle = () => {
    if (filter === "partner") return "パートナーを選択";
    if (filter === "incident") return "事件を選択";
    return "カードを追加";
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: "900px", maxHeight: "90vh" }}
      >
        <div className="modal-header">
          <span>{getTitle()}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* 検索・フィルター */}
        <div style={{ marginBottom: "1rem" }}>
          <div className="search-bar" style={{ marginBottom: "0.75rem", position: "relative" }}>
            <input 
              type="text" 
              placeholder="🔍 カード名・番号で検索..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ paddingRight: search ? "2.5rem" : "0.75rem" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute",
                  right: "0.5rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "1.5rem",
                  height: "1.5rem",
                  borderRadius: "50%",
                  border: "none",
                  background: "#e0e0e0",
                  color: "#666",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1rem",
                  padding: 0,
                }}
                onMouseOver={(e) => e.currentTarget.style.background = "#ccc"}
                onMouseOut={(e) => e.currentTarget.style.background = "#e0e0e0"}
              >
                ✕
              </button>
            )}
          </div>
          {filter === "all" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
              <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)}>
                <option value="">色: 全て</option>
                {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">種類: 全て</option>
                <option value="キャラ">キャラ</option>
                <option value="イベント">イベント</option>
              </select>
              <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
                <option value="">レベル: 全て</option>
                {LEVEL_OPTIONS.map(l => <option key={l} value={l}>Lv{l}</option>)}
              </select>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem" }}>
              <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)}>
                <option value="">色: 全て</option>
                {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* カード一覧 */}
        <div style={{ maxHeight: "500px", overflowY: "auto" }}>
          {filteredCards.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div>カードが見つかりません</div>
            </div>
          ) : (
            <div className="cards-grid">
              {filteredCards.map((card) => {
                const inDeck = deckCardMap.get(card.id!);
                return (
                  <div
                    key={card.id}
                    className="card-item"
                    onClick={() => onSelectCard(card.id!)}
                    style={{
                      opacity: inDeck ? 0.7 : 1,
                      border: inDeck ? "3px solid #667eea" : "2px solid #e0e0e0"
                    }}
                  >
                    <Thumb blob={card.image} alt={card.name ?? "card"} size="small" />
                    {card.color && <div className="card-color-badge" style={{ backgroundColor: colorMap[card.color] }} />}
                    <div className="card-name">{card.name}</div>
                    <div className="card-number" style={{ fontSize: "0.8rem" }}>
                      {card.number || "---"}
                      {card.type ? `/${card.type === "キャラ" ? "キ" : card.type === "イベント" ? "イ" : card.type === "パートナー" ? "パ" : "事"}` : ""}
                      {card.level ? `/${card.level}` : ""}
                    </div>
                    {inDeck && (
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
                        ×{inDeck.count}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
