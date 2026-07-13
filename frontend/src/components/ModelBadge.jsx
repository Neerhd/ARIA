import Badge from "./badge/Badge";

// Traffic-light semantics — matches InputBar's own tier color language
// (cheap/fast → expensive/heavy).
const TIER_COLOR = { 1: "green", 2: "amber", 3: "red" };
const TIER_LABELS = { 1: "T1", 2: "T2", 3: "T3" };

export default function ModelBadge({ tier, model, signals }) {
  if (!tier || !model) return null;
  const shortModel = model.split(":")[0];

  return (
    <Badge
      color={TIER_COLOR[tier] || "green"}
      title={signals?.length ? `Signals: ${signals.join(", ")}` : `Tier ${tier}`}
      className="mt-1.5"
    >
      <span className="font-mono font-bold tabular-nums">{TIER_LABELS[tier]}</span>
      <span className="opacity-70">·</span>
      <span>{shortModel}</span>
    </Badge>
  );
}
