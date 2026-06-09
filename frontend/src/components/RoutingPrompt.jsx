const SIGNAL_ICONS = {
  "file attached": "📎",
  "long conversation (15+ messages)": "💬",
};

export default function RoutingPrompt({ data, onConfirm, onDecline }) {
  const { suggested_tier, suggested_model, signals = [] } = data;
  const shortModel = (suggested_model || "").split(":")[0];

  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div style={{
        maxWidth: "72%", borderRadius: 12, overflow: "hidden",
        border: "1px solid #3730a3", background: "#1a1a2e",
      }}>
        {/* Header */}
        <div style={{
          padding: "10px 14px 8px",
          borderBottom: "1px solid #2a2a4a",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>⚡</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>
            Tier {suggested_tier} recommended
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: "10px 14px" }}>
          <p style={{ fontSize: 13, color: "#cbd5e1", margin: "0 0 8px", lineHeight: 1.5 }}>
            This task would benefit from{" "}
            <strong style={{ color: "#818cf8" }}>{shortModel}</strong>{" "}
            (Tier {suggested_tier}).
          </p>

          {signals.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {signals.map((s) => (
                <span key={s} style={{
                  background: "#0f172a", border: "1px solid #334155",
                  borderRadius: 4, padding: "2px 8px", fontSize: 11, color: "#94a3b8",
                }}>
                  {SIGNAL_ICONS[s] || "•"} {s}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onConfirm}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                background: "#3730a3", color: "#e0e7ff",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Use {shortModel}
            </button>
            <button
              onClick={onDecline}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8,
                border: "1px solid #334155", background: "transparent",
                color: "#94a3b8", fontSize: 13, cursor: "pointer",
              }}
            >
              Keep Tier 1
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
