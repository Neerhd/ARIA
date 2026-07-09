import { Badge } from "@/components/ui/badge";

const TIER_VARIANTS = { 1: "tier1", 2: "tier2", 3: "tier3" };
const TIER_LABELS = { 1: "T1", 2: "T2", 3: "T3" };

export default function ModelBadge({ tier, model, signals }) {
  if (!tier || !model) return null;
  const shortModel = model.split(":")[0];

  return (
    <Badge
      variant={TIER_VARIANTS[tier] || "tier1"}
      title={signals?.length ? `Signals: ${signals.join(", ")}` : `Tier ${tier}`}
      className="mt-1.5 font-normal"
    >
      <span className="font-mono font-bold tabular-nums">{TIER_LABELS[tier]}</span>
      <span className="opacity-70">·</span>
      <span>{shortModel}</span>
    </Badge>
  );
}
