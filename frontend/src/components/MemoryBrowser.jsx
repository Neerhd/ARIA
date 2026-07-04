import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMemoryBrowser } from "@/hooks/useMemoryBrowser";
import PinnedFactsTab from "./memory/PinnedFactsTab";
import EpisodesTab from "./memory/EpisodesTab";
import ConceptsTab from "./memory/ConceptsTab";
import ReflectionsTab from "./memory/ReflectionsTab";

const TABS = ["pinned", "episodes", "concepts", "reflections"];

export default function MemoryBrowser({ open, onOpenChange }) {
  const {
    tab, setTab,
    episodes, concepts, stats, reflections, pinnedFacts,
    activeConcept, loading, running, runResult,
    visibleEpisodes,
    handleConceptClick, handleRunConsolidation, handleDeleteFact,
  } = useMemoryBrowser(open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>🧠 Memory</SheetTitle>
          {stats && (
            <p className="text-[11px] text-muted-foreground">
              {stats.episodes ?? 0} episodes · {stats.concepts ?? 0} concepts · {stats.reflections ?? 0} reflections · {stats.facts ?? 0} pinned
            </p>
          )}
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 gap-0 overflow-hidden px-4">
          <TabsList className="w-full">
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">
                {t}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto pt-3 pb-4">
            {loading && (
              <div className="mt-10 text-center text-[13px] text-muted-foreground">
                Loading memory…
              </div>
            )}

            {!loading && (
              <>
                <TabsContent value="pinned">
                  <PinnedFactsTab pinnedFacts={pinnedFacts} onDeleteFact={handleDeleteFact} />
                </TabsContent>

                <TabsContent value="episodes">
                  <EpisodesTab
                    visibleEpisodes={visibleEpisodes}
                    activeConcept={activeConcept}
                    onConceptClick={handleConceptClick}
                  />
                </TabsContent>

                <TabsContent value="concepts">
                  <ConceptsTab
                    concepts={concepts}
                    activeConcept={activeConcept}
                    onConceptClick={handleConceptClick}
                  />
                </TabsContent>

                <TabsContent value="reflections">
                  <ReflectionsTab
                    reflections={reflections}
                    running={running}
                    runResult={runResult}
                    onRunConsolidation={handleRunConsolidation}
                  />
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
