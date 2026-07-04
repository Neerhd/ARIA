import { useEffect, useState, useCallback } from "react";
import {
  fetchMemoryEpisodes, fetchMemoryConcepts, fetchMemoryStats,
  fetchReflections, triggerConsolidation,
  fetchPinnedFacts, deletePinnedFact,
} from "../services/api";

export function useMemoryBrowser(open) {
  const [tab, setTab] = useState("pinned");
  const [episodes, setEpisodes] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [stats, setStats] = useState(null);
  const [reflections, setReflections] = useState([]);
  const [pinnedFacts, setPinnedFacts] = useState([]);
  const [activeConcept, setActiveConcept] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchMemoryEpisodes(30),
      fetchMemoryConcepts(50),
      fetchMemoryStats(),
      fetchReflections(20),
      fetchPinnedFacts(),
    ]).then(([eps, cons, st, refs, pins]) => {
      setEpisodes(eps);
      setConcepts(cons);
      setStats(st);
      setReflections(refs);
      setPinnedFacts(pins);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (open) loadAll(); }, [open, loadAll]);

  const handleConceptClick = (name) => {
    setActiveConcept((prev) => (prev === name ? null : name));
    if (tab !== "episodes") setTab("episodes");
  };

  const handleRunConsolidation = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await triggerConsolidation();
      setRunResult({
        ok: true,
        message: result.reflections_created > 0
          ? `Created ${result.reflections_created} reflection(s) from ${result.clusters_found} cluster(s).`
          : result.clusters_found === 0
            ? "Not enough data yet — need 3+ episodes per concept."
            : `Found ${result.clusters_found} cluster(s) but model returned no usable reflections.`,
      });
      await fetchReflections(20).then(setReflections);
      await fetchMemoryStats().then(setStats);
    } catch (e) {
      setRunResult({ ok: false, message: e.message });
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteFact = async (factId) => {
    await deletePinnedFact(factId);
    setPinnedFacts((prev) => prev.filter((f) => f.id !== factId));
    setStats((prev) => prev ? { ...prev, facts: Math.max(0, (prev.facts ?? 1) - 1) } : prev);
  };

  const visibleEpisodes = activeConcept
    ? episodes.filter((e) => (e.topics || []).includes(activeConcept))
    : episodes;

  return {
    tab, setTab,
    episodes, concepts, stats, reflections, pinnedFacts,
    activeConcept, loading, running, runResult,
    visibleEpisodes,
    handleConceptClick, handleRunConsolidation, handleDeleteFact,
  };
}
