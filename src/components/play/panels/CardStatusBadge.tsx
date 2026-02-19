interface CardStatus {
  lv: number;
  ap: number;
  lp: number;
}

interface CardStatusBadgeProps {
  status: CardStatus;
  onTap: () => void;
}

// カード中央に表示する半透明バッジ
export function CardStatusBadge({ status, onTap }: CardStatusBadgeProps) {
  const hasChanges = status.lv !== 0 || status.ap !== 0 || status.lp !== 0;

  // 変化がなければ何も表示しない
  if (!hasChanges) return null;

  const formatValue = (val: number) => val >= 0 ? `+${val}` : `${val}`;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(0, 0, 0, 0.6)",
        borderRadius: "8px",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontSize: "0.75rem",
        fontWeight: "bold",
        cursor: "pointer",
        zIndex: 5
      }}
    >
      <span style={{ color: "#4caf50" }}>
        Lv{formatValue(status.lv)}
      </span>
      <span style={{ color: "#2196f3" }}>
        AP{formatValue(status.ap)}
      </span>
      <span style={{ color: "#ff9800" }}>
        LP{formatValue(status.lp)}
      </span>
    </div>
  );
}

interface CardStatusModalProps {
  show: boolean;
  cardName: string;
  status: CardStatus;
  onStatusChange: (newStatus: CardStatus) => void;
  onMoveToRemove: () => void;
  onMoveToEvidence: () => void;
  onViewDetail: () => void;
  onClose: () => void;
}

// タップで開く操作パネルモーダル
export function CardStatusModal({
  show,
  cardName,
  status,
  onStatusChange,
  onMoveToRemove,
  onMoveToEvidence,
  onViewDetail,
  onClose
}: CardStatusModalProps) {
  if (!show) return null;

  return (
    <>
      {/* オーバーレイ */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 200
        }}
      />

      {/* モーダル本体 */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "white",
          borderRadius: "12px",
          padding: "16px",
          minWidth: "280px",
          maxWidth: "90vw",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          zIndex: 201
        }}
      >
        {/* ヘッダー */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "1px solid #eee"
        }}>
          <span style={{ fontWeight: "bold", fontSize: "1rem" }}>
            {cardName || "カード"}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "#eee",
              border: "none",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              fontSize: "1rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            ✕
          </button>
        </div>

        {/* ステータス操作 */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ 
            fontSize: "0.85rem", 
            fontWeight: "bold", 
            marginBottom: "12px",
            color: "#666"
          }}>
            ステータス変化
          </div>

          {/* LV */}
          <StatusRow
            label="LV"
            value={status.lv}
            color="#4caf50"
            step={1}
            onChange={(newVal) => onStatusChange({ ...status, lv: newVal })}
          />

          {/* AP */}
          <StatusRow
            label="AP"
            value={status.ap}
            color="#2196f3"
            step={1000}
            onChange={(newVal) => onStatusChange({ ...status, ap: newVal })}
          />

          {/* LP */}
          <StatusRow
            label="LP"
            value={status.lp}
            color="#ff9800"
            step={1}
            onChange={(newVal) => onStatusChange({ ...status, lp: newVal })}
          />

          {/* リセットボタン */}
          <button
            onClick={() => onStatusChange({ lv: 0, ap: 0, lp: 0 })}
            style={{
              width: "100%",
              marginTop: "8px",
              padding: "8px",
              fontSize: "0.85rem",
              background: "#9e9e9e",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            ステータスリセット
          </button>
        </div>

        {/* カード操作ボタン */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px"
        }}>
          <button
            onClick={() => {
              onViewDetail();
              onClose();
            }}
            style={{
              padding: "12px",
              fontSize: "0.9rem",
              background: "#667eea",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer"
            }}
          >
            🔍 詳細
          </button>
          <button
            onClick={() => {
              onMoveToEvidence();
              onClose();
            }}
            style={{
              padding: "12px",
              fontSize: "0.9rem",
              background: "#9c27b0",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer"
            }}
          >
            🔒 証拠へ
          </button>
          <button
            onClick={() => {
              onMoveToRemove();
              onClose();
            }}
            style={{
              padding: "12px",
              fontSize: "0.9rem",
              background: "#607d8b",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              gridColumn: "1 / -1"
            }}
          >
            🗑️ リムーブへ
          </button>
        </div>
      </div>
    </>
  );
}

// ステータス1行（ラベル + 値 + ±ボタン）
function StatusRow({
  label,
  value,
  color,
  step,
  onChange
}: {
  label: string;
  value: number;
  color: string;
  step: number;
  onChange: (newVal: number) => void;
}) {
  const displayValue = value >= 0 ? `+${value}` : `${value}`;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "10px",
      padding: "8px 12px",
      background: "#f5f5f5",
      borderRadius: "8px"
    }}>
      <span style={{
        fontSize: "1rem",
        fontWeight: "bold",
        color: color,
        minWidth: "36px"
      }}>
        {label}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={() => onChange(value - step)}
          style={{
            width: "36px",
            height: "36px",
            fontSize: "1.2rem",
            fontWeight: "bold",
            background: color,
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer"
          }}
        >
          −
        </button>

        <span style={{
          fontSize: "1.1rem",
          fontWeight: "bold",
          minWidth: "60px",
          textAlign: "center"
        }}>
          {displayValue}
        </span>

        <button
          onClick={() => onChange(value + step)}
          style={{
            width: "36px",
            height: "36px",
            fontSize: "1.2rem",
            fontWeight: "bold",
            background: color,
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer"
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

// エクスポートする型
export type { CardStatus };
