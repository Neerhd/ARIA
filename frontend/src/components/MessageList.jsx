import { useEffect, useRef } from "react";
import { Paperclip, Search, FolderOpen, MessageSquareText, Pin } from "lucide-react";
import ModelBadge from "./ModelBadge";
import RoutingPrompt from "./RoutingPrompt";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MessageList({ messages, loading, onRoutingDecision, onJumpToMemory }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-4 px-6 py-5">
        {messages.map((m) => {
          if (m.role === "routing") {
            return (
              <RoutingPrompt
                key={m.id}
                data={m}
                onConfirm={() => onRoutingDecision(m.id, true)}
                onDecline={() => onRoutingDecision(m.id, false)}
              />
            );
          }

          return (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[72%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground ring-1 ring-border"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="mb-1 text-[10px] font-bold text-muted-foreground">ARIA</div>
                )}
                {m.file_name && (
                  <div className="mb-1.5 inline-flex items-center gap-1.5 rounded bg-primary-foreground/10 px-2 py-0.5 text-[11px]">
                    <Paperclip className="size-3" /> {m.file_name}
                    {m.truncated && <span className="text-amber-400"> (truncated)</span>}
                  </div>
                )}
                {m.content}
                {m.role === "assistant" && m.tier && (
                  <div>
                    {m.tools_used && m.tools_used.length > 0 && (
                      <div className="mt-1.5 mb-0.5 flex flex-wrap gap-1">
                        {[...new Set(m.tools_used)].map((t) => (
                          <Badge key={t} variant="secondary">
                            {t === "web_search" ? <><Search /> web search</> : t === "file_reader" ? <><FolderOpen /> file reader</> : t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <ModelBadge tier={m.tier} model={m.model} signals={m.signals} />
                  </div>
                )}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">Based on:</span>
                    {m.sources.map((s) => (
                      <Badge
                        key={s.ref_id}
                        variant="outline"
                        render={<button type="button" title={s.label} />}
                        onClick={() => onJumpToMemory(s.type, s.ref_id)}
                        className="max-w-[160px] cursor-pointer"
                      >
                        {s.type === "fact" ? <Pin /> : <MessageSquareText />}
                        <span className="truncate">{s.label}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              <span>ARIA is thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
