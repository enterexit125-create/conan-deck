import { useEffect, useState } from "react";

interface ThumbProps {
  blob?: Blob;
  alt: string;
  size?: "small" | "large";
}

export default function Thumb({ blob, alt, size = "small" }: ThumbProps) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  if (!url) {
    return (
      <div className={size === "large" ? "card-image-container" : "deck-card-thumb"}>
        <div className="card-placeholder">🃏</div>
      </div>
    );
  }

  if (size === "large") {
    return (
      <div className="card-image-container">
        <img src={url} alt={alt} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
      </div>
    );
  }

  return (
    <div className="deck-card-thumb">
      <img src={url} alt={alt} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
    </div>
  );
}