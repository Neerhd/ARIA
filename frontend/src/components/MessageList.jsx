import { useEffect, useRef } from "react";
import ModelBadge from "./ModelBadge";
import RoutingPrompt from "./RoutingPrompt";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MessageList({ messages, loading, onRoutingDecision }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[15px] text-muted-foreground">
        Say something to get started.
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
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
                  m.role === "user" ? "bg-violet-600 text-white" : "bg-muted text-foreground"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="mb-1 text-[10px] font-bold text-violet-400">ARIA</div>
                )}
                {m.file_name && (
                  <div className="mb-1.5 inline-flex items-center gap-1.5 rounded bg-white/10 px-2 py-0.5 text-[11px]">
                    📎 {m.file_name}
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
                            {t === "web_search" ? "🔍 web search" : t === "file_reader" ? "📂 file reader" : t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <ModelBadge tier={m.tier} model={m.model} signals={m.signals} />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-muted px-4 py-3 text-sm text-violet-400">
              <span>ARIA is thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
