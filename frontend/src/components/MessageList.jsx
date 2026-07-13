import { useEffect, useRef } from "react";
import { Paperclip, Search, FolderOpen, MessageSquareText, Pin, Copy, RotateCcw, Pencil, Share, Download, MoreHorizontal } from "lucide-react";
import Bubble from "./bubble/Bubble";
import ModelBadge from "./ModelBadge";
import RoutingPrompt from "./RoutingPrompt";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const formatTimestamp = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function MessageList({ messages, loading, onRoutingDecision, onJumpToMemory, onRetryMessage, onEditMessage }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const copyToClipboard = (text) => navigator.clipboard.writeText(text || "");

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6">
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

          const isUser = m.role === "user";
          const actions = isUser
            ? [
                { icon: RotateCcw, label: "Retry", onClick: () => onRetryMessage(m) },
                { icon: Copy, label: "Copy", onClick: () => copyToClipboard(m.content) },
                { icon: Pencil, label: "Edit", onClick: () => onEditMessage(m) },
              ]
            : [
                { icon: Copy, label: "Copy", onClick: () => copyToClipboard(m.content) },
                { icon: Share, label: "Share", onClick: () => {} },
                { icon: RotateCcw, label: "Retry", onClick: () => onRetryMessage(m) },
                { icon: Download, label: "Download", onClick: () => {} },
                { icon: MoreHorizontal, label: "More", onClick: () => {} },
              ];

          return (
            <Bubble key={m.id} role={m.role} timestamp={isUser ? formatTimestamp(m.created_at) : null} actions={actions}>
              {m.file_name && (
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded bg-primary-foreground/10 px-2 py-0.5 text-xs">
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
                  <span className="text-xs text-muted-foreground">Based on:</span>
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
            </Bubble>
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
