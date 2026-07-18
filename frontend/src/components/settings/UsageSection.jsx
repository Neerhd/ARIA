const PURPOSE_LABELS = {
  chat: "Chat replies",
  classifier: "Message routing",
  memory: "Memory upkeep",
  graph_query: "Memory graph queries",
  key_check: "Key checks",
  other: "Other",
};

const fmtCost = (c) => (c >= 0.01 ? `$${c.toFixed(2)}` : c > 0 ? "<$0.01" : "$0.00");
const fmtTokens = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/**
 * Estimated spend over the last 7 days — a meter, not a limiter. Costs come
 * from public per-token prices, so they're close but not billing truth.
 */
export default function UsageSection({ usage }) {
  return (
    <div className="mb-6">
      <div className="mb-2.5 text-[11px] font-bold tracking-wide text-muted-foreground">
        USAGE — LAST 7 DAYS
      </div>
      {usage ? (
        <div className="rounded-lg border border-border p-3">
          <div className="mb-0.5 text-lg font-semibold text-foreground">
            ≈ {fmtCost(usage.total.cost_usd)}
          </div>
          <div className="mb-2 text-[11px] text-muted-foreground">
            {usage.total.calls} AI call{usage.total.calls === 1 ? "" : "s"} ·{" "}
            {fmtTokens(usage.total.input_tokens)} in / {fmtTokens(usage.total.output_tokens)} out
          </div>

          {usage.per_day.length > 0 && (
            <div className="mb-2 flex flex-col gap-0.5">
              {usage.per_day.map((d) => (
                <div key={d.date} className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{d.date}</span>
                  <span>≈ {fmtCost(d.cost_usd)}</span>
                </div>
              ))}
            </div>
          )}

          {Object.keys(usage.by_purpose).length > 0 && (
            <div className="mb-2 border-t border-border pt-2">
              {Object.entries(usage.by_purpose)
                .sort(([, a], [, b]) => b - a)
                .map(([purpose, cost]) => (
                  <div key={purpose} className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{PURPOSE_LABELS[purpose] || purpose}</span>
                    <span>≈ {fmtCost(cost)}</span>
                  </div>
                ))}
            </div>
          )}

          <div className="text-[11px] leading-tight text-muted-foreground/70">
            Estimates from public per-token prices — check your provider's
            console for exact billing.
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Loading usage…</div>
      )}
    </div>
  );
}
