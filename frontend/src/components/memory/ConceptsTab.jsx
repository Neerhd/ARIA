import TopicChip from "./TopicChip";

export default function ConceptsTab({ concepts, activeConcept, onConceptClick }) {
  if (concepts.length === 0) {
    return (
      <div className="mt-10 text-center text-[13px] text-muted-foreground">
        No concepts yet. Topics are extracted as you chat.
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Click a concept to filter episodes by topic.
      </p>
      <div className="flex flex-wrap gap-2">
        {concepts.map((c) => (
          <TopicChip
            key={c.name}
            name={c.name}
            count={c.episode_count}
            onClick={onConceptClick}
            active={activeConcept === c.name}
          />
        ))}
      </div>
    </>
  );
}
