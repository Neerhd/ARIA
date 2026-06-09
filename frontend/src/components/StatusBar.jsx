import { useEffect, useState } from "react";
import { checkHealth } from "../services/api";

export default function StatusBar() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    checkHealth().then(setHealth);
    const id = setInterval(() => checkHealth().then(setHealth), 30000);
    return () => clearInterval(id);
  }, []);

  if (!health) return null;

  const dot = (ok) => (
    <span style={{ color: ok ? "#4ade80" : "#f87171", marginRight: 4 }}>●</span>
  );

  return (
    <div style={{
      display: "flex", gap: 16, padding: "6px 16px",
      background: "#1a1a24", borderBottom: "1px solid #2a2a3a",
      fontSize: 11, color: "#888", alignItems: "center",
    }}>
      <span style={{ color: health.status === "ok" ? "#4ade80" : "#fbbf24", fontWeight: 600 }}>
        ARIA {health.status === "ok" ? "ONLINE" : "DEGRADED"}
      </span>
      <span>{dot(health.ollama)} Ollama ({health.model})</span>
      <span>{dot(health.sqlite)} SQLite</span>
      <span>{dot(health.chroma)} ChromaDB</span>
      <span>{dot(health.neo4j)} Neo4j</span>
    </div>
  );
}
