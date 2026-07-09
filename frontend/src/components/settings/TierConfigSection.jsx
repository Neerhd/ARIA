import { Badge } from "@/components/ui/badge";

export default function TierConfigSection({ config }) {
  return (
    <div>
      <div className="mb-2.5 text-[11px] font-bold tracking-wide text-muted-foreground">
        MODEL TIERS
      </div>
      {config ? (
        <div className="flex flex-col gap-2">
          {Object.entries(config.tiers).map(([tier, info]) => (
            <div
              key={tier}
              className={`rounded-lg border p-3 ${info.available ? "border-primary/40" : "border-border"}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={`text-xs font-bold ${info.available ? "text-foreground" : "text-muted-foreground"}`}>
                  <span className="font-mono tabular-nums">T{tier}</span> · {info.label}
                </span>
                <Badge variant={info.available ? "tier1" : "outline"}>
                  {info.available ? "ready" : "not installed"}
                </Badge>
              </div>
              <div className="mb-0.5 text-[11px] text-muted-foreground">
                {info.model} · {info.type}
              </div>
              <div className="text-[11px] text-muted-foreground/70">{info.description}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Loading tier config…</div>
      )}
    </div>
  );
}
