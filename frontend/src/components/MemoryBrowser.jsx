import { useEffect, useState, useCallback } from "react";
import {
  fetchMemoryEpisodes, fetchMemoryConcepts, fetchMemoryStats,
  fetchReflections, triggerConsolidation,
  fetchPinnedFacts, deletePinnedFact,
} from "../services/api";

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TopicChip({ name, count, onClick, active }) {
  return (
    <button
      onClick={() => onClick(name)}
      style={{
        padding: "4px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer",
        border: `1px solid ${active ? "#7c3aed" : "#2a2a3a"}`,
        background: active ? "#7c3aed22" : "transparent",
        color: active ? "#a78bfa" : "#94a3b8",
        display: "inline-flex", alignItems: "center", gap: 5,
      }}
    >
      {name}
      {count != null && (
        <span style={{ background: "#2a2a3a", borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>
          {count}
        </span>
      )}
    </button>
  );
}

function EpisodeCard({ episode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      style={{
        background: "#1a1a24", border: "1px solid #2a2a3a", borderRadius: 10,
        padding: "12px 14px", cursor: "pointer",
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(episode.topics || []).map((t) => (
            <span key={t} style={{
              background: "#7c3aed22", color: "#a78bfa", borderRadius: 10,
              padding: "2px 8px", fontSize: 11,
            }}>{t}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          {episode.recall_count > 0 && (
            <span title="Times recalled" style={{ fontSize: 11, color: "#4ade80" }}>
              ↑{episode.recall_count}
            </span>
          )}
          <span style={{ fontSize: 11, color: "#4a5568" }}>{timeAgo(episode.timestamp)}</span>
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>
        <span style={{ color: "#6b7280", fontSize: 11 }}>You  </span>
        {expanded ? episode.prompt : (episode.prompt || "").slice(0, 120) + ((episode.prompt || "").length > 120 ? "…" : "")}
      </div>

      {expanded && (
        <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 8, paddingTop: 8, borderTop: "1px solid #2a2a3a" }}>
          <span style={{ color: "#7c3aed", fontSize: 11 }}>ARIA  </span>
          {episode.response}
        </div>
      )}
    </div>
  );
}

function PinnedFactCard({ fact, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    try {
      await onDelete(fact.id);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div style={{
      background: "#13131e",
      border: "1px solid #3d2a6a",
      borderRadius: 10,
      padding: "12px 14px",
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📌</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: "#e2e8f0", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>
          {fact.text}
        </p>
        <span style={{ fontSize: 11, color: "#4a5568", marginTop: 4, display: "block" }}>
          {timeAgo(fact.created_at)}
        </span>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        title={confirming ? "Click again to confirm" : "Remove pinned fact"}
        style={{
          background: confirming ? "#7f1d1d44" : "transparent",
          border: `1px solid ${confirming ? "#ef4444" : "#2a2a3a"}`,
          borderRadius: 6,
          color: confirming ? "#ef4444" : "#4a5568",
          cursor: "pointer",
          fontSize: 12,
          padding: "3px 8px",
          flexShrink: 0,
          transition: "all 0.15s",
        }}
      >
        {deleting ? "…" : confirming ? "Confirm" : "×"}
      </button>
    </div>
  );
}

function ReflectionCard({ reflection }) {
  return (
    <div style={{
      background: "#1a1a24", border: "1px solid #3b2a6a", borderRadius: 10,
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{
          background: "#7c3aed33", color: "#c4b5fd", borderRadius: 10,
          padding: "3px 10px", fontSize: 12, fontWeight: 600,
        }}>
          {reflection.concept}
        </span>
        <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 11, color: "#4a5568" }}>
          <span title="Source episodes">{reflection.episode_count} ep</span>
          <span>{timeAgo(reflection.created_at)}</span>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
        {reflection.text}
      </p>
    </div>
  );
}

export default function MemoryBrowser({ onClose }) {
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

  useEffect(() => { loadAll(); }, [loadAll]);

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

  const tabs = ["pinned", "episodes", "concepts", "reflections"];

  return (
    <div style={{
      position: "absolute", top: 0, right: 0, bottom: 0, width: 420,
      background: "#13131e", borderLeft: "1px solid #2a2a3a",
      display: "flex", flexDirection: "column", zIndex: 100,
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px", borderBottom: "1px solid #2a2a3a",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>🧠 Memory</div>
          {stats && (
            <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>
              {stats.episodes ?? 0} episodes · {stats.concepts ?? 0} concepts · {stats.reflections ?? 0} reflections · {stats.facts ?? 0} pinned
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #2a2a3a" }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "10px", background: "none", border: "none",
            cursor: "pointer", fontSize: 12, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? "#e2e8f0" : "#6b7280",
            borderBottom: tab === t ? "2px solid #7c3aed" : "2px solid transparent",
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loading && (
          <div style={{ color: "#4a5568", fontSize: 13, textAlign: "center", marginTop: 40 }}>
            Loading memory…
          </div>
        )}

        {/* Pinned tab */}
        {!loading && tab === "pinned" && (
          <>
            <p style={{ fontSize: 12, color: "#4a5568", marginBottom: 12 }}>
              Say <span style={{ color: "#a78bfa" }}>"remember this"</span> or{" "}
              <span style={{ color: "#a78bfa" }}>"save this"</span> during any conversation to pin a fact permanently.
              Pinned facts are always injected into every conversation.
            </p>
            {pinnedFacts.length === 0 ? (
              <div style={{ color: "#4a5568", fontSize: 13, textAlign: "center", marginTop: 40 }}>
                No pinned facts yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pinnedFacts.map((f) => (
                  <PinnedFactCard key={f.id} fact={f} onDelete={handleDeleteFact} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Episodes tab */}
        {!loading && tab === "episodes" && (
          <>
            {activeConcept && (
              <div style={{ marginBottom: 10 }}>
                <TopicChip name={activeConcept} onClick={handleConceptClick} active />
                <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
                  {visibleEpisodes.length} episode{visibleEpisodes.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            {visibleEpisodes.length === 0 ? (
              <div style={{ color: "#4a5568", fontSize: 13, textAlign: "center", marginTop: 40 }}>
                {activeConcept ? "No episodes for this concept yet." : "No episodes yet. Start chatting!"}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visibleEpisodes.map((e) => <EpisodeCard key={e.id} episode={e} />)}
              </div>
            )}
          </>
        )}

        {/* Concepts tab */}
        {!loading && tab === "concepts" && (
          <>
            {concepts.length === 0 ? (
              <div style={{ color: "#4a5568", fontSize: 13, textAlign: "center", marginTop: 40 }}>
                No concepts yet. Topics are extracted as you chat.
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "#4a5568", marginBottom: 12 }}>
                  Click a concept to filter episodes by topic.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {concepts.map((c) => (
                    <TopicChip
                      key={c.name}
                      name={c.name}
                      count={c.episode_count}
                      onClick={handleConceptClick}
                      active={activeConcept === c.name}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Reflections tab */}
        {!loading && tab === "reflections" && (
          <>
            {/* Run button */}
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={handleRunConsolidation}
                disabled={running}
                style={{
                  width: "100%", padding: "9px 0",
                  background: running ? "#1a1a24" : "#7c3aed22",
                  border: `1px solid ${running ? "#2a2a3a" : "#7c3aed"}`,
                  borderRadius: 8, cursor: running ? "not-allowed" : "pointer",
                  color: running ? "#6b7280" : "#a78bfa", fontSize: 13, fontWeight: 600,
                }}
              >
                {running ? "Running consolidation…" : "▶ Run Consolidation Now"}
              </button>

              {runResult && (
                <div style={{
                  marginTop: 8, padding: "8px 12px", borderRadius: 8, fontSize: 12,
                  background: runResult.ok ? "#0f2a1a" : "#2d1b1b",
                  color: runResult.ok ? "#4ade80" : "#f87171",
                  border: `1px solid ${runResult.ok ? "#166534" : "#7f1d1d"}`,
                }}>
                  {runResult.message}
                </div>
              )}
            </div>

            <p style={{ fontSize: 11, color: "#4a5568", marginBottom: 12 }}>
              Reflections are synthesised automatically each night from concepts with 3+ episodes.
            </p>

            {reflections.length === 0 ? (
              <div style={{ color: "#4a5568", fontSize: 13, textAlign: "center", marginTop: 30 }}>
                No reflections yet. Chat more, then run consolidation.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reflections.map((r) => <ReflectionCard key={r.id} reflection={r} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
