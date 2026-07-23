import { useEffect, useState, useCallback } from "react";
import { fetchGraph } from "../services/api";

export function useGraphData(active, projectId, scope) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!active) return;
    // No project id yet in project scope (e.g. the projects list hasn't
    // finished its own initial fetch) — resolve loading to false rather
    // than leaving it stuck forever; the effect below re-runs once a real
    // projectId arrives.
    if (scope === "project" && !projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchGraph(projectId, scope)
      .then((data) => {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [active, projectId, scope]);

  useEffect(() => { load(); }, [load]);

  return { nodes, edges, loading, reload: load };
}
