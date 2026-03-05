import { useEffect, useRef, useState } from "react";
import { db } from "../db";

interface ThumbProps {
  blob?: Blob;
  cardId?: number;
  alt: string;
  size?: "small" | "medium" | "large";
  width?: number;   // sizeの代わりにpx指定も可
  height?: number;
  onClick?: () => void;
}

export default function Thumb({ blob, cardId, alt, size = "medium", width: widthProp, height: heightProp, onClick }: ThumbProps) {
  const [src, setSrc] = useState<string>("");
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const sizeMap = {
    small:  { width: 120, height: 168 },
    medium: { width: 180, height: 252 },
    large:  { width: 240, height: 336 },
  };
  const { width: sizeW, height: sizeH } = sizeMap[size];
  const width = widthProp ?? sizeW;
  const height = heightProp ?? sizeH;

  // Intersection Observer: 画面内に入ったときだけロード
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { rootMargin: "200px" } // 200px手前から先読み
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 画像読み込み: 表示範囲に入ったときだけ実行
  useEffect(() => {
    if (!isVisible) return;

    let objectUrl = "";
    let cancelled = false;

    async function load() {
      let imageBlob: Blob | undefined = undefined;

      if (blob) {
        // blob直接渡しの場合（後方互換）
        imageBlob = blob;
      } else if (cardId != null) {
        // cardIdからDBを引く（一覧表示の主ルート）
        const card = await db.cards.get(cardId);
        imageBlob = card?.image;
      }

      if (cancelled || !imageBlob) return;

      objectUrl = URL.createObjectURL(imageBlob);
      if (!cancelled) setSrc(objectUrl);
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isVisible, cardId, blob]);

  const placeholder = (
    <div
      ref={ref}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        minWidth: `${width}px`,
        minHeight: `${height}px`,
        backgroundColor: "#f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "8px",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
    >
      <span style={{ color: "#999", fontSize: "0.75rem" }}>No Image</span>
    </div>
  );

  if (!src) return placeholder;

  return (
    <div ref={ref}>
      <img
        src={src}
        alt={alt}
        onClick={onClick}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "8px",
          cursor: onClick ? "pointer" : "default",
          display: "block",
        }}
      />
    </div>
  );
}
