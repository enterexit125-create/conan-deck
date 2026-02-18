import { useState, type ReactNode } from "react";

interface AccordionSectionProps {
  title: string;
  icon?: string;
  count?: number;
  defaultOpen?: boolean;
  headerColor?: string;
  children: ReactNode;
}

export function AccordionSection({
  title,
  icon,
  count,
  defaultOpen = true,
  headerColor = "#667eea",
  children
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{
      background: "white",
      borderRadius: "8px",
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
    }}>
      {/* ヘッダー（タップで開閉） */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.5rem 0.75rem",
          background: `linear-gradient(135deg, ${headerColor} 0%, ${adjustColor(headerColor, -20)} 100%)`,
          color: "white",
          cursor: "pointer",
          userSelect: "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          {icon && <span style={{ fontSize: "0.9rem" }}>{icon}</span>}
          <span style={{ fontSize: "0.85rem", fontWeight: "bold" }}>{title}</span>
          {count !== undefined && (
            <span style={{
              background: "rgba(255,255,255,0.3)",
              padding: "0.1rem 0.4rem",
              borderRadius: "10px",
              fontSize: "0.75rem"
            }}>
              {count}
            </span>
          )}
        </div>
        <span style={{
          fontSize: "0.8rem",
          transition: "transform 0.2s",
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)"
        }}>
          ▼
        </span>
      </div>

      {/* コンテンツ（アニメーション付き） */}
      <div style={{
        maxHeight: isOpen ? "500px" : "0",
        overflow: "hidden",
        transition: "max-height 0.3s ease",
        background: "#fafafa"
      }}>
        <div style={{ padding: "0.5rem" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// 色を暗くする/明るくするヘルパー関数
function adjustColor(hex: string, amount: number): string {
  // #を除去
  const color = hex.replace("#", "");
  
  // RGB値を取得
  const r = Math.max(0, Math.min(255, parseInt(color.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(color.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(color.substring(4, 6), 16) + amount));
  
  // 16進数に戻す
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
