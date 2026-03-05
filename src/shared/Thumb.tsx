import { useEffect, useRef, useState } from "react";
import { db } from "../db";

interface ThumbProps {
  blob?: Blob;       // 後方互換のため残す（詳細モーダルなど直接blobを渡す場合）
  cardId?: number;   // こちらを優先 - DBから遅延読み込み
  alt: string;
  size?: "small" | "medium" | "large";
  onClick?: () => void;
}

export default function Thumb({ blob, cardId, alt, size = "medium", onClick }: ThumbProps) {
  const [src, setSrc] = useState<string>("");
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const sizeMap = {
    small:  { width: 120, height: 168 },
    medium: { width: 180, height: 252 },
    large:  { width: 240, height: 336 },
  };
  const { width, height } = sizeMap[size];

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
          width: `${width}px`,
          height: `${height}px`,
          objectFit: "contain",
          borderRadius: "8px",
          cursor: onClick ? "pointer" : "default",
          imageRendering: "-webkit-optimize-contrast",
        }}
      />
    </div>
  );
}
