import TopicChip from "./TopicChip";
import EpisodeCard from "./EpisodeCard";

export default function EpisodesTab({ visibleEpisodes, activeConcept, onConceptClick }) {
  return (
    <>
      {activeConcept && (
        <div className="mb-2.5">
          <TopicChip name={activeConcept} onClick={onConceptClick} active />
          <span className="ml-2 text-xs text-muted-foreground">
            {visibleEpisodes.length} episode{visibleEpisodes.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      {visibleEpisodes.length === 0 ? (
        <div className="mt-10 text-center text-[13px] text-muted-foreground">
          {activeConcept ? "No episodes for this concept yet." : "No episodes yet. Start chatting!"}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleEpisodes.map((e) => <EpisodeCard key={e.id} episode={e} />)}
        </div>
      )}
    </>
  );
}
