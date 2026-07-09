import { useEffect, useState } from "react";
import { fetchConversations } from "../services/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Sidebar({ activeId, projectId, onSelect, onNew }) {
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!projectId) { setConversations([]); return; }
    fetchConversations(projectId).then(setConversations).catch(() => {});
  }, [activeId, projectId]);

  return (
    <aside className="flex w-60 min-h-0 flex-col border-r border-border bg-card">
      <div className="shrink-0 px-3 pt-4 pb-2">
        <Button onClick={onNew} className="w-full">
          + New Chat
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`cursor-pointer border-l-[3px] px-3.5 py-2.5 text-[13px] ${
              c.id === activeId
                ? "border-l-primary bg-muted text-foreground"
                : "border-l-transparent text-muted-foreground"
            }`}
          >
            {c.title || "Untitled"}
          </div>
        ))}
      </ScrollArea>
    </aside>
  );
}
