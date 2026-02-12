import React, { useState } from 'react';
import { db } from '../db';

interface CsvImportModalProps {
  show: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function CsvImportModal({ show, onClose, onComplete }: CsvImportModalProps) {
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [errorLog, setErrorLog] = useState<string[]>([]);

  // 画像ダウンロード関数（CORS対応 + エラーハンドリング強化）
  async function downloadImage(imageUrl: string): Promise<Blob | null> {
    if (!imageUrl || imageUrl.trim() === '') {
      return null;
    }

    try {
      // CORSエラー対策
      let response = await fetch(imageUrl, {
        mode: 'cors',
        cache: 'no-cache',
      });

      // CORSエラーの場合は no-cors で再試行
      if (!response.ok && response.type === 'opaque') {
        response = await fetch(imageUrl, {
          mode: 'no-cors',
        });
      }

      if (!response.ok && response.type !== 'opaque') {
        console.error(`画像取得失敗: ${imageUrl} (${response.status})`);
        return null;
      }

      const blob = await response.blob();

      // Blobサイズチェック
      if (blob.size === 0) {
        console.error(`画像サイズが0: ${imageUrl}`);
        return null;
      }

      // 画像形式チェック（no-corsの場合はskip）
      if (blob.type && !blob.type.startsWith('image/')) {
        console.error(`画像形式ではありません: ${imageUrl} (${blob.type})`);
        return null;
      }

      // Blobに画像形式を明示的に設定
      if (!blob.type) {
        const ext = imageUrl.split('.').pop()?.toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === 'png') mimeType = 'image/png';
        if (ext === 'gif') mimeType = 'image/gif';
        if (ext === 'webp') mimeType = 'image/webp';

        return new Blob([blob], { type: mimeType });
      }

      return blob;
    } catch (error) {
      console.error(`画像ダウンロードエラー: ${imageUrl}`, error);
      return null;
    }
  }

  // CSVファイル処理
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setProgress(0);
    setErrorLog([]);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      // ヘッダー行をスキップ
      const dataLines = lines.slice(1);
      setTotal(dataLines.length);

      const errors: string[] = [];
      let successCount = 0;

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        const columns = line.split(',').map(col => col.trim());

        // 最低限の列チェック
        if (columns.length < 2) {
          errors.push(`行${i + 2}: 列が不足しています`);
          continue;
        }

        const [number, name, level, color, type, effect, imageUrl] = columns;

        if (!number || !name) {
          errors.push(`行${i + 2}: 番号または名前が空です`);
          continue;
        }

        try {
          // 画像ダウンロード（URLがある場合）
          let imageBlob: Blob | undefined = undefined;
          if (imageUrl && imageUrl.trim() !== '') {
            const downloadedBlob = await downloadImage(imageUrl);
            if (downloadedBlob) {
              imageBlob = downloadedBlob;
            } else {
              errors.push(`行${i + 2}: 画像取得失敗 (${name})`);
            }
          }

          // 既存カードチェック
          const existingCard = await db.cards
            .where('number')
            .equals(number)
            .first();

          // levelの型変換
          let levelValue: number | undefined = undefined;
          if (level && level.trim() !== '') {
            const parsed = parseInt(level, 10);
            if (!isNaN(parsed)) {
              levelValue = parsed;
            }
          }

          // colorとtypeを空文字列に変換（undefinedを避ける）
          const colorValue = (color && color.trim() !== '') ? color.trim() : '';
          const typeValue = (type && type.trim() !== '') ? type.trim() : '';
          const memoValue = (effect && effect.trim() !== '') ? effect.trim() : '';

          if (existingCard) {
            // 既存カードを更新（putを使う）
            await db.cards.put({
              id: existingCard.id,
              name: name.trim(),
              number: number.trim(),
              color: colorValue,
              type: typeValue,
              level: levelValue,
              memo: memoValue,
              image: imageBlob,
              updatedAt: Date.now(),
              synced: false,
            });
          } else {
            // 新規カード登録
            await db.cards.add({
              name: name.trim(),
              number: number.trim(),
              color: colorValue,
              type: typeValue,
              level: levelValue,
              memo: memoValue,
              image: imageBlob,
              updatedAt: Date.now(),
              synced: false,
            });
          }

          successCount++;
        } catch (error) {
          errors.push(`行${i + 2}: 登録エラー (${name}) - ${error}`);
        }

        setProgress(i + 1);
      }

      setErrorLog(errors);
      alert(`取り込み完了！\n成功: ${successCount}件\nエラー: ${errors.length}件`);
      onComplete();
    } catch (error) {
      alert(`CSVファイルの読み込みに失敗しました: ${error}`);
    } finally {
      setIsImporting(false);
    }
  }

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
      }}>
        <h2>CSV一括取り込み</h2>

        <div style={{ marginBottom: '16px' }}>
          <p>CSVファイルを選択してください</p>
          <p style={{ fontSize: '12px', color: '#666' }}>
            フォーマット: number,name,level,color,type,effect,image_url
          </p>
        </div>

        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          disabled={isImporting}
          style={{ marginBottom: '16px' }}
        />

        {isImporting && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ marginBottom: '8px' }}>
              取り込み中... {progress} / {total}
            </div>
            <div style={{
              width: '100%',
              height: '20px',
              backgroundColor: '#eee',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${(progress / total) * 100}%`,
                height: '100%',
                backgroundColor: '#4CAF50',
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )}

        {errorLog.length > 0 && (
          <div style={{
            maxHeight: '200px',
            overflow: 'auto',
            backgroundColor: '#fff3cd',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
          }}>
            <h4>エラーログ ({errorLog.length}件)</h4>
            {errorLog.map((err, idx) => (
              <div key={idx} style={{ fontSize: '12px', marginBottom: '4px' }}>
                {err}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isImporting}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ccc',
              border: 'none',
              borderRadius: '4px',
              cursor: isImporting ? 'not-allowed' : 'pointer',
            }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
