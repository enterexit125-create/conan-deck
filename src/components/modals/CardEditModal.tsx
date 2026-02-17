import type { Card } from "../../db";
import { COLOR_OPTIONS, TYPE_OPTIONS, LEVEL_OPTIONS } from "../../shared/constants";

interface CardEditModalProps {
  editingCard: Card | null;
  editForm: Partial<Card>;
  setEditForm: (form: Partial<Card> | ((prev: Partial<Card>) => Partial<Card>)) => void;
  editImageFile: File | null;
  setEditImageFile: (file: File | null) => void;
  onClose: () => void;
  onSave: () => void;
}

export function CardEditModal({
  editingCard,
  editForm,
  setEditForm,
  editImageFile,
  setEditImageFile,
  onClose,
  onSave,
}: CardEditModalProps) {
  if (!editingCard) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>カードを編集</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-grid">
          <input 
            type="text" 
            placeholder="カード名（必須）" 
            value={editForm.name ?? ""} 
            onChange={(e) => setEditForm((p: any) => ({ ...p, name: e.target.value }))} 
          />
          <div className="form-row">
            <input 
              type="text" 
              placeholder="カード番号（必須）" 
              value={editForm.number ?? ""} 
              onChange={(e) => setEditForm((p: any) => ({ ...p, number: e.target.value }))} 
            />
            <select 
              value={editForm.color ?? "黄"} 
              onChange={(e) => setEditForm((p: any) => ({ ...p, color: e.target.value }))}
            >
              {COLOR_OPTIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-row">
            <select 
              value={editForm.type ?? "キャラ"} 
              onChange={(e) => setEditForm((p: any) => ({ ...p, type: e.target.value }))}
            >
              {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
            </select>
            <select 
              value={editForm.level ?? 1} 
              onChange={(e) => setEditForm((p: any) => ({ ...p, level: parseInt(e.target.value) }))}
            >
              {LEVEL_OPTIONS.map(l => <option key={l} value={l}>Lv{l}</option>)}
            </select>
          </div>
          <input 
            type="text" 
            placeholder="特徴（例: 少年探偵団、FBI、黒の組織）" 
            value={editForm.traits ?? ""} 
            onChange={(e) => setEditForm((p: any) => ({ ...p, traits: e.target.value }))} 
          />
          <textarea 
            placeholder="メモ（任意）" 
            value={editForm.memo ?? ""} 
            onChange={(e) => setEditForm((p: any) => ({ ...p, memo: e.target.value }))} 
            rows={3} 
          />
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
              画像を変更（任意）
            </label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setEditImageFile(e.target.files?.[0] ?? null)} 
            />
            {editImageFile && (
              <img 
                src={URL.createObjectURL(editImageFile)} 
                alt="プレビュー" 
                className="image-preview" 
              />
            )}
            {!editImageFile && editingCard.image && (
              <div style={{ marginTop: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
                現在の画像を保持（変更する場合は上で選択）
              </div>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" onClick={onSave}>✅ 保存</button>
        </div>
      </div>
    </div>
  );
}
