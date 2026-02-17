import type { Card } from "../db";
import Thumb from "../shared/Thumb";
import { colorMap, COLOR_OPTIONS, TYPE_OPTIONS, LEVEL_OPTIONS } from "../shared/constants";

interface CardListProps {
  // カードデータ
  cards: Card[];
  filteredCards: Card[];
  
  // 検索・フィルター
  search: string;
  setSearch: (value: string) => void;
  filterColor: string;
  setFilterColor: (value: string) => void;
  filterType: string;
  setFilterType: (value: string) => void;
  filterLevel: string;
  setFilterLevel: (value: string) => void;
  
  // カード登録フォーム
  showCardForm: boolean;
  setShowCardForm: (value: boolean) => void;
  form: Partial<Card>;
  setForm: (value: Partial<Card> | ((prev: Partial<Card>) => Partial<Card>)) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  
  // 選択モード
  isSelectionMode: boolean;
  setIsSelectionMode: (value: boolean) => void;
  selectedCardIds: Set<number>;
  
  // 関数
  saveCard: () => Promise<void>;
  deleteCard: (id: number) => Promise<void>;
  addCardToDeck: (cardId: number) => Promise<void>;
  openEditCard: (card: Card) => void;
  openCardDetail: (card: Card) => void;
  toggleCardSelection: (id: number) => void;
  toggleSelectAll: () => void;
  deleteSelectedCards: () => Promise<void>;
  setShowCsvImport: (value: boolean) => void;
}

export function CardList({
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
  showCardForm,
  setShowCardForm,
  form,
  setForm,
  imageFile,
  setImageFile,
  isSelectionMode,
  setIsSelectionMode,
  selectedCardIds,
  saveCard,
  deleteCard,
  addCardToDeck,
  openEditCard,
  openCardDetail,
  toggleCardSelection,
  toggleSelectAll,
  deleteSelectedCards,
  setShowCsvImport,
}: CardListProps) {
  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">カード一覧</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-secondary" onClick={() => setShowCsvImport(true)} style={{ padding: "0.75rem 1rem" }}>
            📥 CSV取り込み
          </button>
          <button className="btn-primary" onClick={() => setShowCardForm(!showCardForm)}>
            {showCardForm ? "✕" : "➕"}
          </button>
        </div>
      </div>

      {showCardForm && (
        <div className="form-grid" style={{ marginBottom: "1rem", background: "#f5f7fa", padding: "0.75rem", borderRadius: "8px" }}>
          <input type="text" placeholder="カード名（必須）" value={form.name ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, name: e.target.value }))} />
          <div className="form-row">
            <input type="text" placeholder="カード番号（必須）" value={form.number ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, number: e.target.value }))} />
            <select value={form.color ?? "黄"} onChange={(e) => setForm((p: any) => ({ ...p, color: e.target.value }))}>
              {COLOR_OPTIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-row">
            <select value={form.type ?? "キャラ"} onChange={(e) => setForm((p: any) => ({ ...p, type: e.target.value }))}>
              {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={form.level ?? 1} onChange={(e) => setForm((p: any) => ({ ...p, level: parseInt(e.target.value) }))}>
              {LEVEL_OPTIONS.map(l => <option key={l} value={l}>Lv{l}</option>)}
            </select>
          </div>
          <input type="text" placeholder="特徴（例: 少年探偵団、FBI、黒の組織）" value={form.traits ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, traits: e.target.value }))} />
          <textarea placeholder="メモ（任意）" value={form.memo ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, memo: e.target.value }))} rows={2} />
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
          <button className="btn-primary" onClick={saveCard}>✅ 保存</button>
        </div>
      )}

      {/* 検索とフィルターを1行に統合 */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "2fr 1fr 1fr 1fr", 
        gap: "0.4rem",
        marginBottom: "1rem"
      }}>
        <div style={{ position: "relative" }}>
          <input 
            type="text" 
            placeholder="🔍 検索..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              paddingRight: search ? "2.5rem" : "0.5rem",
              border: "2px solid #e0e0e0",
              borderRadius: "8px",
              fontSize: "0.9rem",
              boxSizing: "border-box"
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
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.8rem",
                color: "#666"
              }}
            >
              ✕
            </button>
          )}
        </div>
        <select 
          value={filterColor} 
          onChange={(e) => setFilterColor(e.target.value)}
          style={{
            padding: "0.5rem",
            border: "2px solid #e0e0e0",
            borderRadius: "8px",
            fontSize: "0.9rem",
            backgroundColor: filterColor ? "#fff3e0" : "white"
          }}
        >
          <option value="">色</option>
          {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: "0.5rem",
            border: "2px solid #e0e0e0",
            borderRadius: "8px",
            fontSize: "0.9rem",
            backgroundColor: filterType ? "#e3f2fd" : "white"
          }}
        >
          <option value="">種類</option>
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select 
          value={filterLevel} 
          onChange={(e) => setFilterLevel(e.target.value)}
          style={{
            padding: "0.5rem",
            border: "2px solid #e0e0e0",
            borderRadius: "8px",
            fontSize: "0.9rem",
            backgroundColor: filterLevel ? "#f3e5f5" : "white"
          }}
        >
          <option value="">Lv</option>
          {LEVEL_OPTIONS.map(l => <option key={l} value={l.toString()}>Lv{l}</option>)}
        </select>
      </div>

      {/* 選択モードボタン */}
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button 
          className={isSelectionMode ? "btn-primary" : "btn-secondary"}
          onClick={() => setIsSelectionMode(!isSelectionMode)}
          style={{ padding: "0.5rem 1rem" }}
        >
          {isSelectionMode ? "✓ 選択モード" : "□ 選択モード"}
        </button>
        {isSelectionMode && (
          <>
            <button 
              className="btn-secondary"
              onClick={toggleSelectAll}
              style={{ padding: "0.5rem 1rem" }}
            >
              {selectedCardIds.size === filteredCards.length ? "全解除" : "全選択"}
            </button>
            {selectedCardIds.size > 0 && (
              <button 
                className="btn-danger"
                onClick={deleteSelectedCards}
                style={{ padding: "0.5rem 1rem" }}
              >
                🗑️ {selectedCardIds.size}件削除
              </button>
            )}
          </>
        )}
      </div>

      <div>
        {filteredCards.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🃏</div>
            <div>カードが見つかりません</div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>検索条件を変更してください</div>
          </div>
        ) : (
          <div className="cards-grid" style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "0.5rem"
          }}>
            {filteredCards.map((c) => (
              <div 
                key={c.id} 
                className="card-item" 
                style={{ 
                  position: "relative",
                  backgroundColor: c.id !== undefined && selectedCardIds.has(c.id) ? "#f5deb3" : "white",
                  transition: "background-color 0.2s"
                }}
              >
                {c.color && <div className="card-color-badge" style={{ background: colorMap[c.color] || "#9e9e9e" }} />}
                
                {/* 選択モード時のチェックボックス */}
                {isSelectionMode && c.id !== undefined && (
                  <div 
                    style={{
                      position: "absolute",
                      top: "0.25rem",
                      right: "0.25rem",
                      zIndex: 10
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCardSelection(c.id!);
                    }}
                  >
                    <div
                      style={{
                        width: "1.5rem",
                        height: "1.5rem",
                        borderRadius: "4px",
                        border: "2px solid #d4a574",
                        backgroundColor: selectedCardIds.has(c.id) ? "#d4a574" : "white",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s"
                      }}
                    >
                      {selectedCardIds.has(c.id) && (
                        <span style={{ color: "white", fontSize: "1rem", fontWeight: "bold" }}>✓</span>
                      )}
                    </div>
                  </div>
                )}
                
                <div onClick={() => openCardDetail(c)} style={{ cursor: "pointer" }}>
                  <Thumb blob={c.image} alt={c.name ?? "card"} size="small" />
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
