import { useEffect, useState } from "react";

interface ThumbProps {
  blob?: Blob;
  alt: string;
  size?: "small" | "medium" | "large";
  onClick?: () => void;
}

export default function Thumb({ blob, alt, size = "medium", onClick }: ThumbProps) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    if (!blob) {
      setSrc("");
      return;
    }
    
    // Blobから高画質URLを生成
    const url = URL.createObjectURL(blob);
    setSrc(url);
    
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  // サイズ設定（大きめに）
  const sizeMap = {
    small: { width: 120, height: 168 },   // 小: カード比率 5:7
    medium: { width: 180, height: 252 },  // 中: 一覧用
    large: { width: 240, height: 336 },   // 大: 詳細表示用
  };

  const { width, height } = sizeMap[size];

  if (!src) {
    return (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: "#f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          cursor: onClick ? "pointer" : "default",
        }}
        onClick={onClick}
      >
        <span style={{ color: "#999" }}>No Image</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onClick={onClick}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        objectFit: "contain",  // cover ではなく contain
        borderRadius: "8px",
        cursor: onClick ? "pointer" : "default",
        imageRendering: "-webkit-optimize-contrast", // 画質向上
      }}
    />
  );
}
