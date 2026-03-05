import React, { useState, useRef } from 'react';
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
  
  // 画像ファイル用
  const [imageFiles, setImageFiles] = useState<Map<string, File>>(new Map());
  const [imageCount, setImageCount] = useState(0);
  
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 画像ファイルを選択
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    
    const imageMap = new Map<string, File>();
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // ファイル名をキーにして保存
      imageMap.set(file.name, file);
    }
    
    setImageFiles(imageMap);
    setImageCount(imageMap.size);
  }

  // FileをBlobに変換
  async function fileToBlob(file: File): Promise<Blob> {
    return new Blob([await file.arrayBuffer()], { type: file.type });
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

      // ヘッダー行を解析
      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
      
      // 各列のインデックスを取得
      const numberIdx = headers.indexOf('number');
      const nameIdx = headers.indexOf('name');
      const levelIdx = headers.indexOf('level');
      const colorIdx = headers.indexOf('color');
      const typeIdx = headers.indexOf('type');
      const traitsIdx = headers.indexOf('traits');
      const memoIdx = headers.indexOf('memo');
      const imageIdx = headers.indexOf('image');
      
      // 必須列チェック
      if (numberIdx === -1 || nameIdx === -1) {
        alert('CSVにnumberとname列が必要です');
        setIsImporting(false);
        return;
      }

      // データ行を処理
      const dataLines = lines.slice(1);
      setTotal(dataLines.length);

      const errors: string[] = [];
      let successCount = 0;
      let imageSuccessCount = 0;

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        
        // CSVのパース（引用符内のカンマを考慮）
        const columns = parseCSVLine(line);

        // 最低限の列チェック
        if (columns.length < 2) {
          errors.push(`行${i + 2}: 列が不足しています`);
          continue;
        }

        const number = columns[numberIdx]?.trim() || '';
        const name = columns[nameIdx]?.trim() || '';
        const level = levelIdx !== -1 ? columns[levelIdx]?.trim() : '';
        const color = colorIdx !== -1 ? columns[colorIdx]?.trim() : '';
        const type = typeIdx !== -1 ? columns[typeIdx]?.trim() : '';
        const traits = traitsIdx !== -1 ? columns[traitsIdx]?.trim() : '';
        const memo = memoIdx !== -1 ? columns[memoIdx]?.trim() : '';
        const imageFileName = imageIdx !== -1 ? columns[imageIdx]?.trim() : '';

        if (!number || !name) {
          errors.push(`行${i + 2}: 番号または名前が空です`);
          continue;
        }

        try {
          // 既存カードチェック（番号と画像ファイル名の組み合わせで判定）
          let existingCard = null;
          
          // 画像ファイル名がある場合、同じ番号で同じ画像ファイル名のカードを探す
          if (imageFileName) {
            const cardsWithSameNumber = await db.cards
              .where('number')
              .equals(number)
              .toArray();
            
            // 画像ファイル名が一致するものを探す（なければ最初のもの）
            existingCard = cardsWithSameNumber.find(c => {
              // imageUrlに画像ファイル名が含まれているかチェック
              return c.imageUrl?.includes(imageFileName);
            });
            
            // 一致するものがなく、画像がないカードがあればそれを使う
            if (!existingCard) {
              existingCard = cardsWithSameNumber.find(c => !c.image && !c.imageUrl);
            }
          } else {
            existingCard = await db.cards
              .where('number')
              .equals(number)
              .first();
          }

          // levelの型変換
          let levelValue: number | undefined = undefined;
          if (level && level.trim() !== '') {
            const parsed = parseInt(level, 10);
            if (!isNaN(parsed)) {
              levelValue = parsed;
            }
          }

          // 値の正規化
          const nameValue = name.trim();
          const numberValue = number.trim();
          const colorValue = (color && color.trim() !== '') ? color.trim() : '';
          
          let typeValue = (type && type.trim() !== '') ? type.trim() : '';
          if (typeValue === 'キャラクター') typeValue = 'キャラ';
          if (typeValue === 'イベントカード') typeValue = 'イベント';
          if (typeValue === 'パートナーカード') typeValue = 'パートナー';
          if (typeValue === '事件カード') typeValue = '事件';
          
          const traitsValue = (traits && traits.trim() !== '') ? traits.trim() : '';
          const memoValue = (memo && memo.trim() !== '') ? memo.trim() : '';

          // 画像ファイルを取得
          let imageBlob: Blob | undefined = undefined;
          if (imageFileName && imageFiles.has(imageFileName)) {
            const imageFile = imageFiles.get(imageFileName)!;
            imageBlob = await fileToBlob(imageFile);
            imageSuccessCount++;
          }

          if (existingCard) {
            // 既存カードを更新
            await db.cards.put({
              id: existingCard.id,
              name: nameValue,
              number: numberValue,
              color: colorValue || existingCard.color,
              type: typeValue || existingCard.type,
              level: levelValue !== undefined ? levelValue : existingCard.level,
              traits: traitsValue || existingCard.traits,
              memo: memoValue || existingCard.memo,
              image: imageBlob || existingCard.image,  // 新しい画像があれば上書き
              imageUrl: existingCard.imageUrl,
              updatedAt: Date.now(),
              synced: false,
            });
          } else {
            // 新規カード登録
            await db.cards.add({
              name: nameValue,
              number: numberValue,
              color: colorValue,
              type: typeValue,
              level: levelValue,
              traits: traitsValue,
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
      alert(`取り込み完了！\n成功: ${successCount}件\n画像: ${imageSuccessCount}件\nエラー: ${errors.length}件`);
      onComplete();
    } catch (error) {
      alert(`CSVファイルの読み込みに失敗しました: ${error}`);
    } finally {
      setIsImporting(false);
    }
  }

  // CSVの1行をパース（引用符内のカンマを考慮）
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  // モーダルをリセット
  function handleClose() {
    setImageFiles(new Map());
    setImageCount(0);
    setErrorLog([]);
    setProgress(0);
    setTotal(0);
    if (csvInputRef.current) csvInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    onClose();
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

        {/* 手順1: 画像フォルダ選択 */}
        <div style={{ 
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
            📁 手順1: 画像ファイルを選択（任意）
          </h3>
          <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>
            複数の画像ファイルをまとめて選択できます
          </p>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            disabled={isImporting}
          />
          {imageCount > 0 && (
            <p style={{ 
              margin: '8px 0 0 0', 
              fontSize: '12px', 
              color: '#4CAF50',
              fontWeight: 'bold' 
            }}>
              ✅ {imageCount}個の画像ファイルを選択中
            </p>
          )}
        </div>

        {/* 手順2: CSVファイル選択 */}
        <div style={{ 
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#fff3e0',
          borderRadius: '8px',
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
            📄 手順2: CSVファイルを選択
          </h3>
          <p style={{ fontSize: '12px', color: '#666', margin: '0 0 4px 0' }}>
            フォーマット: number,name,level,color,type,traits,memo,<strong>image</strong>
          </p>
          <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>
            ※ image列には画像ファイル名を入力（例: 0337.png）
          </p>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={isImporting}
          />
        </div>

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
            onClick={handleClose}
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
