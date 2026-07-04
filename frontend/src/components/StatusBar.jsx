import { useEffect, useState } from "react";
import { checkHealth } from "../services/api";
import { Badge } from "@/components/ui/badge";

export default function StatusBar() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    checkHealth().then(setHealth);
    const id = setInterval(() => checkHealth().then(setHealth), 30000);
    return () => clearInterval(id);
  }, []);

  if (!health) return null;

  const dot = (ok) => (
    <span className={ok ? "text-green-500" : "text-red-400"}>●</span>
  );

  return (
    <div className="flex items-center gap-4 border-b border-border bg-muted px-4 py-1.5 text-[11px] text-muted-foreground">
      <span className={`font-semibold ${health.status === "ok" ? "text-green-500" : "text-amber-400"}`}>
        ARIA {health.status === "ok" ? "ONLINE" : "DEGRADED"}
      </span>
      <Badge variant="outline" className="gap-1.5">{dot(health.ollama)} Ollama ({health.model})</Badge>
      <Badge variant="outline" className="gap-1.5">{dot(health.sqlite)} SQLite</Badge>
      <Badge variant="outline" className="gap-1.5">{dot(health.chroma)} ChromaDB</Badge>
      <Badge variant="outline" className="gap-1.5">{dot(health.neo4j)} Neo4j</Badge>
    </div>
  );
}
