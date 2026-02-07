interface SyncPanelProps {
  syncing: boolean;
  syncMessage: string;
  handleFullSync: () => Promise<void>;
  handleDownloadSync: () => Promise<void>;
  handleUploadSync: () => Promise<void>;
}

export default function SyncPanel({
  syncing,
  syncMessage,
  handleFullSync,
  handleDownloadSync,
  handleUploadSync
}: SyncPanelProps) {
  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">クラウド同期</h2>
      </div>

      <div className="info-panel" style={{ marginBottom: "1.5rem" }}>
        <div className="info-panel-title">📱 複数端末でデータを共有</div>
        <div className="info-panel-text">
          Supabaseクラウドにデータを保存して、スマホ・PC・タブレットなど複数の端末で同じデータを使えます。
          <br />
          初回は「⬆️ アップロード」でデータをクラウドに保存してください。
        </div>
      </div>

      {syncMessage && (
        <div style={{
          padding: "1rem",
          marginBottom: "1rem",
          background: "#e3f2fd",
          border: "2px solid #2196f3",
          borderRadius: "12px",
          textAlign: "center",
          fontSize: "1.1rem",
          fontWeight: "bold",
          color: "#1565c0"
        }}>
          {syncMessage}
        </div>
      )}

      <div style={{ display: "grid", gap: "1rem" }}>
        <button
          className="btn-primary"
          onClick={handleFullSync}
          disabled={syncing}
          style={{
            padding: "1rem",
            fontSize: "1.1rem",
            opacity: syncing ? 0.6 : 1,
            cursor: syncing ? "not-allowed" : "pointer"
          }}
        >
          🔄 完全同期（双方向）
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <button
            className="btn-secondary"
            onClick={handleDownloadSync}
            disabled={syncing}
            style={{
              padding: "1rem",
              fontSize: "1rem",
              opacity: syncing ? 0.6 : 1,
              cursor: syncing ? "not-allowed" : "pointer"
            }}
          >
            ⬇️ ダウンロード
          </button>

          <button
            className="btn-secondary"
            onClick={handleUploadSync}
            disabled={syncing}
            style={{
              padding: "1rem",
              fontSize: "1rem",
              opacity: syncing ? 0.6 : 1,
              cursor: syncing ? "not-allowed" : "pointer"
            }}
          >
            ⬆️ アップロード
          </button>
        </div>
      </div>

      <div style={{
        marginTop: "2rem",
        padding: "1rem",
        background: "#fff3e0",
        border: "2px solid #ff9800",
        borderRadius: "12px"
      }}>
        <div style={{ fontWeight: "bold", marginBottom: "0.5rem", color: "#e65100" }}>
          ⚠️ 注意事項
        </div>
        <ul style={{ marginLeft: "1.5rem", color: "#bf360c", lineHeight: "1.6" }}>
          <li>完全同期：クラウドとローカルの最新データを統合します</li>
          <li>ダウンロード：クラウドのデータでローカルを上書きします</li>
          <li>アップロード：ローカルのデータでクラウドを上書きします</li>
          <li>データが消える可能性があるため、重要なデータは事前にバックアップしてください</li>
        </ul>
      </div>
    </div>
  );
}