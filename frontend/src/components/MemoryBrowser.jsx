import { useEffect, useState } from "react";
import { fetchMemoryEpisodes, fetchMemoryConcepts, fetchMemoryStats } from "../services/api";

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

export default function MemoryBrowser({ onClose }) {
  const [tab, setTab] = useState("episodes");
  const [episodes, setEpisodes] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeConcept, setActiveConcept] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchMemoryEpisodes(30),
      fetchMemoryConcepts(50),
      fetchMemoryStats(),
    ]).then(([eps, cons, st]) => {
      setEpisodes(eps);
      setConcepts(cons);
      setStats(st);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleConceptClick = (name) => {
    setActiveConcept((prev) => (prev === name ? null : name));
    if (tab !== "episodes") setTab("episodes");
  };

  const visibleEpisodes = activeConcept
    ? episodes.filter((e) => (e.topics || []).includes(activeConcept))
    : episodes;

  return (
    <div style={{
      position: "absolute", top: 0, right: 0, bottom: 0, width: 400,
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
              {stats.episodes ?? 0} episodes · {stats.concepts ?? 0} concepts
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
        {["episodes", "concepts"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "10px", background: "none", border: "none",
            cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 600 : 400,
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
      </div>
    </div>
  );
}
