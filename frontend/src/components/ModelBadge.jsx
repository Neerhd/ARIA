const TIER_COLORS = {
  1: { bg: "#1a2a1a", border: "#166534", text: "#4ade80" },
  2: { bg: "#1a1a2e", border: "#3730a3", text: "#818cf8" },
  3: { bg: "#2a1a1a", border: "#7f1d1d", text: "#f87171" },
};

const TIER_LABELS = { 1: "T1", 2: "T2", 3: "T3" };

export default function ModelBadge({ tier, model, signals }) {
  if (!tier || !model) return null;
  const c = TIER_COLORS[tier] || TIER_COLORS[1];
  const shortModel = model.split(":")[0];

  return (
    <div
      title={signals?.length ? `Signals: ${signals.join(", ")}` : `Tier ${tier}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 5, padding: "2px 7px",
        fontSize: 10, color: c.text, marginTop: 6, cursor: "default",
      }}
    >
      <span style={{ fontWeight: 700 }}>{TIER_LABELS[tier]}</span>
      <span style={{ opacity: 0.7 }}>·</span>
      <span>{shortModel}</span>
    </div>
  );
}
