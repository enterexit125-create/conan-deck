interface CardStatus {
  lv: number;
  ap: number;
  lp: number;
}

interface CardStatusOverlayProps {
  status: CardStatus;
  onStatusChange: (newStatus: CardStatus) => void;
}

export function CardStatusOverlay({ status, onStatusChange }: CardStatusOverlayProps) {
  // 変化があるかどうか（初期値: LV=0, AP=0, LP=0）
  const hasChanges = status.lv !== 0 || status.ap !== 0 || status.lp !== 0;

  // 変化がなければ何も表示しない
  if (!hasChanges) {
    // タップで表示を開始するためのトリガーエリア
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          // 最初のタップでLV+1して表示開始
          onStatusChange({ ...status, lv: 1 });
        }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 5
        }}
      />
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        borderRadius: "3px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "2px",
        zIndex: 10,
        padding: "2px"
      }}
    >
      {/* 上げるボタン行 */}
      <div style={{ display: "flex", gap: "4px" }}>
        <StatusButton
          label="▲"
          onClick={() => onStatusChange({ ...status, lv: status.lv + 1 })}
          color="#4caf50"
        />
        <StatusButton
          label="▲"
          onClick={() => onStatusChange({ ...status, ap: status.ap + 1000 })}
          color="#2196f3"
        />
        <StatusButton
          label="▲"
          onClick={() => onStatusChange({ ...status, lp: status.lp + 1 })}
          color="#ff9800"
        />
      </div>

      {/* ステータス表示行 */}
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <StatusDisplay label="LV" value={status.lv} color="#4caf50" />
        <StatusDisplay label="AP" value={status.ap} suffix={status.ap >= 0 ? "+" : ""} color="#2196f3" />
        <StatusDisplay label="LP" value={status.lp} color="#ff9800" />
      </div>

      {/* 下げるボタン行 */}
      <div style={{ display: "flex", gap: "4px" }}>
        <StatusButton
          label="▼"
          onClick={() => onStatusChange({ ...status, lv: status.lv - 1 })}
          color="#4caf50"
        />
        <StatusButton
          label="▼"
          onClick={() => onStatusChange({ ...status, ap: status.ap - 1000 })}
          color="#2196f3"
        />
        <StatusButton
          label="▼"
          onClick={() => onStatusChange({ ...status, lp: status.lp - 1 })}
          color="#ff9800"
        />
      </div>

      {/* リセットボタン */}
      <button
        onClick={() => onStatusChange({ lv: 0, ap: 0, lp: 0 })}
        style={{
          marginTop: "2px",
          padding: "2px 8px",
          fontSize: "0.6rem",
          background: "#666",
          color: "white",
          border: "none",
          borderRadius: "3px",
          cursor: "pointer"
        }}
      >
        リセット
      </button>
    </div>
  );
}

// ステータス増減ボタン
function StatusButton({ 
  label, 
  onClick, 
  color 
}: { 
  label: string; 
  onClick: () => void; 
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "22px",
        height: "18px",
        fontSize: "0.7rem",
        fontWeight: "bold",
        background: color,
        color: "white",
        border: "none",
        borderRadius: "3px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0
      }}
    >
      {label}
    </button>
  );
}

// ステータス表示
function StatusDisplay({ 
  label, 
  value, 
  suffix = "",
  color 
}: { 
  label: string; 
  value: number; 
  suffix?: string;
  color: string;
}) {
  const displayValue = label === "AP" 
    ? (value >= 0 ? `+${value}` : `${value}`)
    : (value >= 0 ? `+${value}` : `${value}`);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      minWidth: "22px"
    }}>
      <span style={{
        fontSize: "0.5rem",
        color: color,
        fontWeight: "bold"
      }}>
        {label}
      </span>
      <span style={{
        fontSize: "0.65rem",
        color: "white",
        fontWeight: "bold"
      }}>
        {displayValue}
      </span>
    </div>
  );
}

// エクスポートする型
export type { CardStatus };
