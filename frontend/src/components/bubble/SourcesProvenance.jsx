import { useState } from "react";
import { Pin, MessageSquareText, Sparkles, ChevronRight } from "lucide-react";
import Tooltip from "../tooltip/Tooltip";
import Button from "../button/Button";
import { correctFact } from "../../services/api";
import { cn } from "@/lib/utils";

const DAY_MS = 86400000;
const TYPE_ICON = { fact: Pin, episode: MessageSquareText, reflection: Sparkles };

function ageInDays(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / DAY_MS;
}

// Tier 1 — the ambient, zero-click signal: how old is the weakest link this
// reply rests on. Not alarming for "old" (--muted-foreground, not
// destructive) — staleness alone isn't wrong, it's just worth a second look.
function freshnessClass(sources) {
  const oldest = Math.max(...sources.map((s) => ageInDays(s.timestamp)));
  if (oldest <= 7) return "text-stat-positive";
  if (oldest <= 30) return "text-warning";
  return "text-muted-foreground";
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "date unknown";
}

// Tier 3 for a Fact — the payoff of the whole design: a source that's wrong
// becomes an edit to ARIA's memory, right here, not a trip to a settings page.
function FactCorrection({ source, onDone }) {
  const [state, setState] = useState("ask"); // ask | correcting | saving | saved | error
  const [text, setText] = useState("");

  const handleSave = async () => {
    if (!text.trim()) return;
    setState("saving");
    try {
      await correctFact(source.ref_id, text.trim());
      setState("saved");
      setTimeout(onDone, 1000);
    } catch {
      setState("error");
    }
  };

  if (state === "saved") {
    return <p className="text-xs text-stat-positive">Updated — ARIA will use the corrected fact from now on.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-foreground">{source.label}</p>
      <p className="text-[11px] text-muted-foreground">Pinned {formatDate(source.timestamp)}</p>
      {state === "ask" && (
        <div className="flex gap-1.5">
          <Button size="small" variant="secondary" onClick={onDone}>Still true</Button>
          <Button size="small" variant="secondary" onClick={() => setState("correcting")}>This changed</Button>
        </div>
      )}
      {state !== "ask" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="What's true now?"
              disabled={state === "saving"}
              className="min-w-0 flex-1 rounded-button border border-input-border bg-background px-2 py-1 text-xs text-input-foreground outline-none disabled:opacity-50"
            />
            <Button size="small" variant="primary" onClick={handleSave} disabled={state === "saving" || !text.trim()}>
              Save
            </Button>
          </div>
          {state === "error" && <p className="text-[11px] text-destructive">Couldn't save that — try again.</p>}
        </div>
      )}
    </div>
  );
}

// Tier 3 for an episode/reflection — these are historical record, not a
// living fact, so "fixing" it means telling ARIA the current truth as a
// normal message rather than editing history.
function RecordDetail({ source, onDone, onComposeCorrection }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-foreground">{source.label}</p>
      <p className="text-[11px] text-muted-foreground">{formatDate(source.timestamp)}</p>
      <div className="flex gap-1.5">
        <Button size="small" variant="secondary" onClick={onDone}>Looks right</Button>
        <Button
          size="small"
          variant="secondary"
          onClick={() => onComposeCorrection(`Update to something I mentioned before ("${source.label}") — here's what's actually true now: `)}
        >
          This seems outdated
        </Button>
      </div>
    </div>
  );
}

// Tier 2 — click to unfold a timeline (position = date, so staleness is
// visible as geometry) with connector lines drawn only where a source
// isn't actually independent of another (a reflection alongside the exact
// episode it was synthesised from, or two episodes sharing a concept) —
// see related_to, computed server-side in chat.py. Click a dot for tier 3.
export default function SourcesProvenance({ sources, onComposeCorrection }) {
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState(null);
  if (!sources || sources.length === 0) return null;

  const times = sources.map((s) => new Date(s.timestamp || 0).getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min;
  // 4–96% keeps a dot from ever sitting flush against the row's edge.
  const xPercent = (iso) => (span > 0 ? ((new Date(iso || min).getTime() - min) / span) * 92 + 4 : 50);

  // Sources created close together in time (e.g. several facts extracted
  // from the same conversation) would otherwise land at ~identical x and
  // stack exactly on top of one another — not just visually confusing but
  // making every dot but the last one literally unclickable. Alternate
  // rows and nudge x slightly whenever two dots would collide.
  const ROW_Y = [18, 38];
  const layout = [...sources]
    .sort((a, b) => xPercent(a.timestamp) - xPercent(b.timestamp))
    .reduce((acc, s) => {
      let x = xPercent(s.timestamp);
      const prev = acc[acc.length - 1];
      const row = prev && x - prev.x < 6 ? 1 - prev.row : 0;
      if (prev && x - prev.x < 6) x = prev.x + 6;
      acc.push({ ...s, x, row });
      return acc;
    }, []);
  const twoRows = layout.some((s) => s.row === 1);
  const byId = Object.fromEntries(layout.map((s) => [s.ref_id, s]));
  const pairs = [];
  const seen = new Set();
  for (const s of sources) {
    for (const otherId of s.related_to || []) {
      const key = [s.ref_id, otherId].sort().join("|");
      if (seen.has(key) || !byId[otherId]) continue;
      seen.add(key);
      pairs.push([byId[s.ref_id], byId[otherId]]);
    }
  }

  const openSource = openId ? byId[openId] : null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="font-sidebar inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground outline-none hover:text-foreground"
        aria-expanded={expanded}
      >
        <ChevronRight className={cn("size-3 shrink-0 transition-transform", expanded && "rotate-90")} strokeWidth={1.75} aria-hidden="true" />
        <span className={cn("inline-block size-1.5 shrink-0 rounded-full bg-current", freshnessClass(sources))} aria-hidden="true" />
        {sources.length} source{sources.length > 1 ? "s" : ""}
      </button>

      {expanded && (
        <div className="mt-2 rounded-input border border-input-border bg-background p-3">
          <div className={cn("relative w-full", twoRows ? "h-12" : "h-9")}>
            <svg className="absolute inset-0 h-full w-full overflow-visible">
              {pairs.map(([a, b], i) => (
                <path
                  key={i}
                  d={`M ${a.x}% ${ROW_Y[a.row]} Q ${(a.x + b.x) / 2}% 2, ${b.x}% ${ROW_Y[b.row]}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-border"
                />
              ))}
            </svg>
            {layout.map((s) => {
              const Icon = TYPE_ICON[s.type] || MessageSquareText;
              const isOpen = openId === s.ref_id;
              return (
                <Tooltip key={s.ref_id} label={s.label} side="top">
                  <button
                    type="button"
                    onClick={() => setOpenId((v) => (v === s.ref_id ? null : s.ref_id))}
                    style={{ left: `${s.x}%`, top: `${ROW_Y[s.row]}px` }}
                    className={cn(
                      "absolute flex size-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border outline-none transition-colors",
                      isOpen ? "border-primary bg-primary/10" : "border-input-border bg-background hover:bg-button-clean-hover"
                    )}
                    aria-label={s.label}
                  >
                    <Icon className="size-3" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </Tooltip>
              );
            })}
          </div>

          {openSource && (
            <div className="mt-3 border-t border-border pt-3">
              {openSource.type === "fact" ? (
                <FactCorrection source={openSource} onDone={() => setOpenId(null)} />
              ) : (
                <RecordDetail
                  source={openSource}
                  onDone={() => setOpenId(null)}
                  onComposeCorrection={(draft) => {
                    onComposeCorrection(draft);
                    setOpenId(null);
                    setExpanded(false);
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
