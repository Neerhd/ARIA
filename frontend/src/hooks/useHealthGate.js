import { useEffect, useState } from "react";
import { resolveApiBase } from "../services/apiBase";

const POLL_INTERVAL_MS = 500;

const NOT_READY = { sqlite: false, chroma: false, neo4j: false };

// Gates on the infrastructure fields only — sqlite/chroma/neo4j — never on
// `status` or `providers`. With no provider API key configured,
// backend/api/health.py's `all_ok` never becomes true, so /health returns
// "degraded" forever; gating on "ok" would block the user from ever
// reaching FirstRunSetup, which is what fixes that state. See NEE-16
// Phase 0 notes.
export function useHealthGate() {
  const [health, setHealth] = useState(NOT_READY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${resolveApiBase()}/health`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setHealth(data);
        if (data.sqlite && data.chroma && data.neo4j) setReady(true);
      } catch {
        // Backend not reachable yet (still starting, or attaching to a
        // slower-booting Neo4j) — keep polling.
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ready]);

  return { health, ready };
}
