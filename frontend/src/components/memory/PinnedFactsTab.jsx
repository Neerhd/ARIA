import PinnedFactCard from "./PinnedFactCard";

export default function PinnedFactsTab({ pinnedFacts, onDeleteFact }) {
  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Say <span className="text-primary">"remember this"</span> or{" "}
        <span className="text-primary">"save this"</span> during any conversation to pin a fact permanently.
        Pinned facts are always injected into every conversation.
      </p>
      {pinnedFacts.length === 0 ? (
        <div className="mt-10 text-center text-[13px] text-muted-foreground">
          No pinned facts yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pinnedFacts.map((f) => (
            <PinnedFactCard key={f.id} fact={f} onDelete={onDeleteFact} />
          ))}
        </div>
      )}
    </>
  );
}
