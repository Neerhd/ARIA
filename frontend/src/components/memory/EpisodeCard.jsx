import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import Badge from "../badge/Badge";
import { timeAgo } from "@/lib/time";

export default function EpisodeCard({ episode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
      <CardContent>
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(episode.topics || []).map((t) => (
              <Badge key={t} color="teal">{t}</Badge>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {episode.recall_count > 0 && (
              <span title="Times recalled" className="font-mono text-[11px] text-stat-positive tabular-nums">
                ↑{episode.recall_count}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">{timeAgo(episode.timestamp)}</span>
          </div>
        </div>

        <div className="mb-1 text-[13px] text-muted-foreground">
          <span className="text-[11px] text-muted-foreground/70">You  </span>
          {expanded ? episode.prompt : (episode.prompt || "").slice(0, 120) + ((episode.prompt || "").length > 120 ? "…" : "")}
        </div>

        {expanded && (
          <div className="mt-2 border-t border-border pt-2 text-[13px] text-foreground">
            <span className="text-[11px] text-primary">ARIA  </span>
            {episode.response}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
