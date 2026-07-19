import PinnedFactCard from "./PinnedFactCard";

// Profile groups, in display order. "pinned" collects user_pinned facts
// regardless of category; the rest are ARIA's auto-captured facts (Layer 4).
const GROUPS = [
  ["pinned", "Pinned by you"],
  ["person", "People"],
  ["preference", "Preferences"],
  ["decision", "Decisions"],
  ["commitment", "Commitments & deadlines"],
  ["thread", "Open threads"],
  ["other", "Other"],
];

export default function PinnedFactsTab({ pinnedFacts, onDeleteFact }) {
  const grouped = {};
  for (const f of pinnedFacts) {
    const key = f.user_pinned ? "pinned" : f.category || "other";
    (grouped[key] ||= []).push(f);
  }

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        ARIA builds this profile automatically from your conversations —
        newer facts replace older ones. Say{" "}
        <span className="text-primary">"remember this"</span> to pin something
        permanently, and delete anything ARIA shouldn't believe.
      </p>
      {pinnedFacts.length === 0 ? (
        <div className="mt-10 text-center text-[13px] text-muted-foreground">
          Nothing in the profile yet — it fills in as you chat.
        </div>
      ) : (
        GROUPS.map(([key, label]) =>
          grouped[key]?.length ? (
            <div key={key} className="mb-4">
              <div className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground">
                {label.toUpperCase()}
              </div>
              <div className="flex flex-col gap-2">
                {grouped[key].map((f) => (
                  <PinnedFactCard key={f.id} fact={f} onDelete={onDeleteFact} />
                ))}
              </div>
            </div>
          ) : null
        )
      )}
    </>
  );
}
