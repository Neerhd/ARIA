import { useEffect, useState, useCallback } from "react";
import { fetchGraph } from "../services/api";

export function useGraphData(active, projectId, scope) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!active) return;
    if (scope === "project" && !projectId) return;
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
