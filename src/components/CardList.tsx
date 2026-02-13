import type { Card, DeckCard } from "../db";
import Thumb from "../shared/Thumb";
import { COLOR_OPTIONS, TYPE_OPTIONS, LEVEL_OPTIONS, colorMap } from "../shared/constants";

interface CardListProps {
  cards: Card[];
  filteredCards: Card[];
  search: string;
  setSearch: (search: string) => void;
  filterColor: string;
  setFilterColor: (color: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  filterLevel: string;
  setFilterLevel: (level: string) => void;
  form: Partial<Card>;
  setForm: (form: Partial<Card>) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  showCardForm: boolean;
  setShowCardForm: (show: boolean) => void;
  saveCard: () => Promise<void>;
  openEditCard: (card: Card) => void;
  addCardToDeck: (cardId: number) => Promise<void>;
  deleteCard: (cardId: number) => Promise<void>;
  openCardDetail: (card: Card) => void;
  deckCardMap: Map<number, DeckCard>;
}

export default function CardList({
  cards,
  filteredCards,
  search,
  setSearch,
  filterColor,
  setFilterColor,
  filterType,
  setFilterType,
  filterLevel,
  setFilterLevel,
  form,
  setForm,
  imageFile,
  setImageFile,
  showCardForm,
  setShowCardForm,
  saveCard,
  openEditCard,
  addCardToDeck,
  deleteCard,
  openCardDetail,
  deckCardMap
}: CardListProps) {
  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">カード一覧</h2>
        <button className="btn-primary" onClick={() => setShowCardForm(!showCardForm)}>
          {showCardForm ? "✕" : "➕"}
        </button>
      </div>

      {showCardForm && (
        <div className="form-grid" style={{ marginBottom: "1rem", background: "#f5f7fa", padding: "0.75rem", borderRadius: "8px" }}>
          <input type="text" placeholder="カード名（必須）" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="form-row">
            <input type="text" placeholder="カード番号（必須）" value={form.number ?? ""} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            <select value={form.color ?? "黄"} onChange={(e) => setForm({ ...form, color: e.target.value })}>
              {COLOR_OPTIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-row">
            <select value={form.type ?? "キャラ"} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={form.level ?? 1} onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) })}>
              {LEVEL_OPTIONS.map(l => <option key={l} value={l}>Lv{l}</option>)}
            </select>
          </div>
          <input type="text" placeholder="特徴（例: 少年探偵団、FBI、黒の組織）" value={form.traits ?? ""} onChange={(e) => setForm({ ...form, traits: e.target.value })} />
          <textarea placeholder="メモ（任意）" value={form.memo ?? ""} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={2} />
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
          <button className="btn-primary" onClick={saveCard}>✅ 保存</button>
        </div>
      )}

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "2fr 1fr 1fr 1fr", 
        gap: "0.4rem",
        marginBottom: "1rem"
      }}>
        <div style={{ position: "relative" }}>
          <input 
            type="text" 
            placeholder="🔍 カード名・番号で検索" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              width: "100%", 
              boxSizing: "border-box",
              padding: "0.5rem",
              paddingRight: search ? "2.5rem" : "0.5rem"
            }}
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
                zIndex: 10
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "#ccc"}
              onMouseOut={(e) => e.currentTarget.style.background = "#e0e0e0"}
            >
              ✕
            </button>
          )}
        </div>
        <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)}>
          <option value="">色: 全て</option>
          {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">種類: 全て</option>
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
          <option value="">レベル: 全て</option>
          {LEVEL_OPTIONS.map(l => <option key={l} value={l}>Lv{l}</option>)}
        </select>
      </div>

      {filteredCards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div>カードが見つかりません</div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#666" }}>
            {cards.length === 0 ? "右上の ➕ ボタンから新しいカードを追加してください" : "検索条件を変更してください"}
          </div>
        </div>
      ) : (
        <div className="cards-grid">
          {filteredCards.map((c) => {
            const inDeck = deckCardMap.get(c.id!);
            return (
              <div key={c.id} className="card-item">
                {c.color && <div className="card-color-badge" style={{ background: colorMap[c.color] || "#9e9e9e" }} />}
                <div onClick={() => openCardDetail(c)} style={{ cursor: "pointer" }}>
                  <Thumb blob={c.image} alt={c.name ?? "card"} size="large" />
                </div>
                <div className="card-name">{c.name}</div>
                <div className="card-number" style={{ fontSize: "0.8rem" }}>
                  {c.number || "---"}
                  {c.type ? `/${c.type === "キャラ" ? "キ" : c.type === "イベント" ? "イ" : c.type === "パートナー" ? "パ" : "事"}` : ""}
                  {c.level ? `/${c.level}` : ""}
                </div>
                <div className="card-actions">
                  <button className="btn-secondary" style={{ padding: "0.4rem", fontSize: "1.1rem" }} onClick={() => openEditCard(c)}>✏️</button>
                  <button className="btn-primary" style={{ flex: 1, padding: "0.4rem", fontSize: "1.1rem" }} onClick={() => addCardToDeck(c.id!)}>➕</button>
                  <button className="btn-danger btn-icon" style={{ padding: "0.4rem", fontSize: "1.1rem", background: "#ffb74d", borderColor: "#ffb74d" }} onClick={() => deleteCard(c.id!)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}