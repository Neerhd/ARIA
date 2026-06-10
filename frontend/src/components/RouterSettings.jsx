import { useEffect, useState } from "react";
import { fetchRouterConfig } from "../services/api";

const MODES = [
  { key: "auto",   label: "Auto",   desc: "System picks the model based on what you're doing. You see which model responded." },
  { key: "ask",    label: "Ask",    desc: "System suggests an upgrade when it detects a heavier task, but asks your permission first." },
  { key: "manual", label: "Manual", desc: "You choose the tier for every conversation. Full control." },
];

const TIER_COLORS = {
  1: { color: "#4ade80", border: "#166534" },
  2: { color: "#818cf8", border: "#3730a3" },
  3: { color: "#f87171", border: "#7f1d1d" },
};

const TOOLS = [
  {
    key: "web_search",
    label: "Web Search",
    icon: "🔍",
    desc: "Search the web via SearXNG (self-hosted). Auto-upgrades to T3 when enabled.",
    note: "Requires SearXNG running on localhost:8080",
  },
  {
    key: "file_reader",
    label: "File Reader",
    icon: "📂",
    desc: "ARIA can read any local file by path during the conversation.",
    note: "Works on all tiers — no upgrade required",
  },
  {
    key: "file_writer",
    label: "File Writer",
    icon: "💾",
    desc: "ARIA can create and write files to any local path (e.g. save a report to your Desktop).",
    note: "Works on all tiers — creates missing directories automatically",
  },
];

export default function RouterSettings({ routingMode, onModeChange, toolsEnabled, onToolToggle, onClose }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetchRouterConfig().then(setConfig).catch(() => {});
  }, []);

  return (
    <div style={{
      position: "absolute", top: 0, right: 0, bottom: 0, width: 340,
      background: "#13131e", borderLeft: "1px solid #2a2a3a",
      display: "flex", flexDirection: "column", zIndex: 100,
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px", borderBottom: "1px solid #2a2a3a",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>⚙ Settings</div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18 }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {/* Routing mode */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, marginBottom: 10 }}>
            ROUTING MODE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MODES.map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => onModeChange(key)}
                style={{
                  padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                  border: `1px solid ${routingMode === key ? "#7c3aed" : "#2a2a3a"}`,
                  background: routingMode === key ? "#7c3aed22" : "transparent",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: routingMode === key ? "#a78bfa" : "#e2e8f0", marginBottom: 3 }}>
                  {routingMode === key ? "✓ " : ""}{label}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, marginBottom: 10 }}>
            TOOLS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {TOOLS.map(({ key, label, icon, desc, note }) => {
              const active = toolsEnabled.includes(key);
              return (
                <div
                  key={key}
                  style={{
                    padding: "10px 12px", borderRadius: 8,
                    border: `1px solid ${active ? "#7c3aed" : "#2a2a3a"}`,
                    background: active ? "#7c3aed11" : "#1a1a24",
                    display: "flex", alignItems: "flex-start", gap: 10,
                    cursor: "pointer",
                  }}
                  onClick={() => onToolToggle(key, !active)}
                >
                  <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: active ? "#a78bfa" : "#e2e8f0", marginBottom: 2,
                    }}>
                      {active ? "✓ " : ""}{label}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.4, marginBottom: 3 }}>{desc}</div>
                    <div style={{ fontSize: 10, color: "#4a5568" }}>{note}</div>
                  </div>
                  <div style={{
                    width: 36, height: 20, borderRadius: 10, flexShrink: 0, marginTop: 2,
                    background: active ? "#7c3aed" : "#2a2a3a",
                    position: "relative", transition: "background 0.2s",
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3,
                      left: active ? 19 : 3,
                      transition: "left 0.2s",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tier config */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, marginBottom: 10 }}>
            MODEL TIERS
          </div>
          {config ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(config.tiers).map(([tier, info]) => {
                const t = parseInt(tier);
                const c = TIER_COLORS[t] || TIER_COLORS[1];
                return (
                  <div key={tier} style={{
                    padding: "10px 12px", borderRadius: 8,
                    border: `1px solid ${info.available ? c.border : "#2a2a3a"}`,
                    background: "#1a1a24",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: info.available ? c.color : "#4a5568" }}>
                        T{tier} · {info.label}
                      </span>
                      <span style={{
                        fontSize: 10, padding: "1px 6px", borderRadius: 4,
                        background: info.available ? "#0f2a1a" : "#1a1a1a",
                        color: info.available ? "#4ade80" : "#4a5568",
                        border: `1px solid ${info.available ? "#166534" : "#2a2a3a"}`,
                      }}>
                        {info.available ? "ready" : "not installed"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
                      {info.model} · {info.type}
                    </div>
                    <div style={{ fontSize: 11, color: "#4a5568" }}>{info.description}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: "#4a5568", fontSize: 13 }}>Loading tier config…</div>
          )}
        </div>
      </div>
    </div>
  );
}
