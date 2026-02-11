import { useState } from "react";
import { db } from "../db";

interface CsvImportModalProps {
  show: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function CsvImportModal({ show, onClose, onComplete }: CsvImportModalProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  function handleCsvFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCsvFile(file);
    
    // CSVをプレビュー
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // ヘッダー行をスキップして最初の5件をプレビュー
      const preview = lines.slice(1, 6).map(line => {
        const cols = line.split(',').map(col => col.trim());
        return {
          number: cols[0] || '',
          name: cols[1] || '',
          level: cols[2] || '',
          color: cols[3] || '',
          type: cols[4] || '',
          effect: cols[5] || '',
          image_url: cols[6] || ''
        };
      });
      
      setCsvPreview(preview);
      setImportTotal(lines.length - 1); // ヘッダー除く
    };
    reader.readAsText(file);
  }

  async function executeCsvImport() {
    if (!csvFile) return;
    
    setIsImporting(true);
    setImportProgress(0);
    setImportMessage("CSVファイルを読み込み中...");
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // ヘッダーをスキップ
      const dataLines = lines.slice(1);
      setImportTotal(dataLines.length);
      
      let successCount = 0;
      let errorCount = 0;
      
      // 10件ずつバッチ処理
      for (let i = 0; i < dataLines.length; i += 10) {
        const batch = dataLines.slice(i, i + 10);
        
        await Promise.all(batch.map(async (line, batchIndex) => {
          try {
            const cols = line.split(',').map(col => col.trim());
            const [number, name, level, color, type, effect, imageUrl] = cols;
            
            if (!number || !name) {
              errorCount++;
              return;
            }
            
            // 画像をダウンロード
            let imageBlob: Blob | undefined = undefined;
            if (imageUrl) {
              try {
                setImportMessage(`画像ダウンロード中: ${name} (${i + batchIndex + 1}/${dataLines.length})`);
                const response = await fetch(imageUrl);
                if (response.ok) {
                  imageBlob = await response.blob();
                }
              } catch (err) {
                console.warn(`画像ダウンロード失敗: ${imageUrl}`, err);
              }
            }
            
            // カードを登録（重複チェック：番号で判定）
            const existing = await db.cards.where('number').equals(number).first();
            if (existing) {
              // 更新
              await db.cards.update(existing.id!, {
                name,
                number,
                level: level || undefined,
                color: color || undefined,
                type: type || undefined,
                memo: effect || undefined,
                image: imageBlob || existing.image,
                updatedAt: Date.now(),
                synced: false
              });
            } else {
              // 新規登録
              await db.cards.add({
                name,
                number,
                level: level || undefined,
                color: color || undefined,
                type: type || undefined,
                memo: effect || undefined,
                image: imageBlob,
                updatedAt: Date.now(),
                synced: false
              });
            }
            
            successCount++;
            setImportProgress(i + batchIndex + 1);
            setImportMessage(`登録中: ${i + batchIndex + 1}/${dataLines.length} 件`);
          } catch (err) {
            console.error('カード登録エラー:', err);
            errorCount++;
          }
        }));
        
        // UI更新のため少し待つ
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setImportMessage(`✅ 完了！ 成功: ${successCount}件 / エラー: ${errorCount}件`);
      setIsImporting(false);
      
      // 完了コールバック
      onComplete();
      
      // 3秒後にモーダルを閉じる
      setTimeout(() => {
        handleClose();
      }, 3000);
    };
    
    reader.readAsText(csvFile);
  }

  function handleClose() {
    setCsvFile(null);
    setCsvPreview([]);
    setImportProgress(0);
    setImportTotal(0);
    setImportMessage("");
    setIsImporting(false);
    onClose();
  }

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={!isImporting ? handleClose : undefined}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
        <div className="modal-header">
          <span>📥 CSVからカード一括取り込み</span>
          {!isImporting && <button className="modal-close" onClick={handleClose}>✕</button>}
        </div>

        {!csvFile ? (
          // ファイル選択画面
          <div>
            <div className="info-panel" style={{ marginBottom: "1rem" }}>
              <div className="info-panel-title">CSVファイルの形式</div>
              <div className="info-panel-text">
                <p style={{ marginBottom: "0.5rem" }}>以下の形式でCSVを用意してください：</p>
                <pre style={{ 
                  background: "#f5f5f5", 
                  padding: "0.75rem", 
                  borderRadius: "6px", 
                  fontSize: "0.85rem",
                  overflow: "auto"
                }}>
{`number,name,level,color,type,effect,image_url
001,江戸川コナン,5,青,キャラクター,推理+2,https://...
002,灰原哀,4,紫,キャラクター,科学+1,https://...`}
                </pre>
                <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#666" }}>
                  ※ 1行目はヘッダー行です<br />
                  ※ image_urlは任意（空欄可）<br />
                  ※ 重複するカード番号は上書きされます
                </p>
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ 
                display: "block", 
                padding: "2rem", 
                border: "2px dashed #667eea", 
                borderRadius: "12px", 
                textAlign: "center",
                cursor: "pointer",
                background: "#f5f7fa",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "#e8eaf6"}
              onMouseOut={(e) => e.currentTarget.style.background = "#f5f7fa"}
              >
                <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📄</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#667eea" }}>
                  CSVファイルを選択
                </div>
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleCsvFileSelect}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>
        ) : !isImporting ? (
          // プレビュー画面
          <div>
            <div style={{ 
              background: "#e8f5e9", 
              padding: "1rem", 
              borderRadius: "8px", 
              marginBottom: "1rem",
              border: "2px solid #66bb6a"
            }}>
              <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#2e7d32", marginBottom: "0.5rem" }}>
                ✅ ファイル読み込み完了
              </div>
              <div style={{ color: "#1b5e20" }}>
                {csvFile.name} ({importTotal}件のカードを取り込みます)
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>プレビュー（最初の5件）:</div>
              <div style={{ 
                maxHeight: "300px", 
                overflow: "auto", 
                border: "1px solid #e0e0e0", 
                borderRadius: "8px"
              }}>
                <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                  <thead style={{ background: "#f5f5f5", position: "sticky", top: 0 }}>
                    <tr>
                      <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid #e0e0e0" }}>番号</th>
                      <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid #e0e0e0" }}>名前</th>
                      <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid #e0e0e0" }}>Lv</th>
                      <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid #e0e0e0" }}>色</th>
                      <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid #e0e0e0" }}>画像</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "0.5rem" }}>{row.number}</td>
                        <td style={{ padding: "0.5rem" }}>{row.name}</td>
                        <td style={{ padding: "0.5rem" }}>{row.level}</td>
                        <td style={{ padding: "0.5rem" }}>{row.color}</td>
                        <td style={{ padding: "0.5rem" }}>{row.image_url ? "✅" : "－"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleClose}>
                キャンセル
              </button>
              <button className="btn-primary" onClick={executeCsvImport}>
                ✅ {importTotal}件を取り込む
              </button>
            </div>
          </div>
        ) : (
          // 取り込み中画面
          <div>
            <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
              <div style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "1.5rem" }}>
                カードを取り込み中...
              </div>
              
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ 
                  background: "#e0e0e0", 
                  height: "24px", 
                  borderRadius: "12px", 
                  overflow: "hidden",
                  position: "relative"
                }}>
                  <div style={{
                    background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
                    height: "100%",
                    width: `${(importProgress / importTotal) * 100}%`,
                    transition: "width 0.3s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "0.85rem",
                    fontWeight: "bold"
                  }}>
                    {Math.round((importProgress / importTotal) * 100)}%
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "1.1rem", color: "#666", marginBottom: "0.5rem" }}>
                {importProgress} / {importTotal} 件
              </div>
              
              <div style={{ fontSize: "0.9rem", color: "#999" }}>
                {importMessage}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
