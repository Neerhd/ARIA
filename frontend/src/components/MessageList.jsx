import { useEffect, useRef, useState } from "react";
import { Paperclip, MessageSquareText, Pin, Copy, RotateCcw, Pencil, Share, Download, MoreHorizontal, ChevronRight } from "lucide-react";
import Bubble from "./bubble/Bubble";
import Markdown from "./bubble/Markdown";
import RetryModelMenu from "./bubble/RetryModelMenu";
import Badge from "./badge/Badge";
import { useScrollThumb } from "../hooks/useScrollThumb";
import { cn } from "@/lib/utils";

const formatTimestamp = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

// Sources are collapsed by default — a citation list isn't something you
// need to see on every reply, just a one-click way to check it when you do.
function SourcesDisclosure({ sources, onJumpToMemory }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="font-sidebar inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground outline-none hover:text-foreground"
        aria-expanded={expanded}
      >
        <ChevronRight className={cn("size-3 shrink-0 transition-transform", expanded && "rotate-90")} strokeWidth={1.75} aria-hidden="true" />
        {sources.length} source{sources.length > 1 ? "s" : ""}
      </button>
      {expanded && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {sources.map((s) => (
            <Badge
              key={s.ref_id}
              color="neutral"
              icon={s.type === "fact" ? Pin : MessageSquareText}
              onClick={() => onJumpToMemory(s.type, s.ref_id)}
              title={s.label}
              className="max-w-[160px]"
            >
              {s.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MessageList({ messages, loading, onJumpToMemory, onRetryMessage, onEditMessage, modelOptions = [] }) {
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const {
    thumb,
    active: thumbActive,
    setActive: setThumbActive,
    scrolledFromTop,
    scrolledToBottom,
    update: updateThumb,
    handlePointerDown: handleThumbPointerDown,
  } = useScrollThumb(scrollRef, contentRef);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const copyToClipboard = (text) => navigator.clipboard.writeText(text || "");

  return (
    <div
      className="relative min-h-0 flex-1"
      onMouseEnter={() => setThumbActive(true)}
      onMouseLeave={() => setThumbActive(false)}
    >
      <div
        ref={scrollRef}
        onScroll={updateThumb}
        className={cn("scroll-hidden h-full overflow-y-auto", thumb.height > 0 && "pr-1.5")}
      >
        <div ref={contentRef} className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6">
          {messages.map((m) => {
            const isUser = m.role === "user";
            // Tool-used and model badges are intentionally not surfaced here —
            // that's metadata, not something needed on every reply. Retrying
            // with a specific model (RetryModelMenu) covers the one thing
            // model choice actually matters for day to day.
            const actions = isUser
              ? [
                  { icon: RotateCcw, label: "Retry", onClick: () => onRetryMessage(m) },
                  { icon: Copy, label: "Copy", onClick: () => copyToClipboard(m.content) },
                  { icon: Pencil, label: "Edit", onClick: () => onEditMessage(m) },
                ]
              : [
                  { icon: Copy, label: "Copy", onClick: () => copyToClipboard(m.content) },
                  { icon: Share, label: "Share", onClick: () => {} },
                  { label: "Retry", render: <RetryModelMenu options={modelOptions} onRetry={(sel) => onRetryMessage(m, sel)} /> },
                  { icon: Download, label: "Download", onClick: () => {} },
                  { icon: MoreHorizontal, label: "More", onClick: () => {} },
                ];

            return (
              <Bubble key={m.id} role={m.role} timestamp={isUser ? formatTimestamp(m.created_at) : null} actions={actions}>
                {m.file_name && (
                  <div className="mb-1.5 inline-flex items-center gap-1.5 rounded bg-primary-foreground/10 px-2 py-0.5 text-xs">
                    <Paperclip className="size-3" /> {m.file_name}
                    {m.truncated && <span className="text-warning"> (truncated)</span>}
                  </div>
                )}
                {isUser ? (
                  m.content
                ) : m.streaming && !m.content ? (
                  <span className="text-muted-foreground">ARIA is thinking…</span>
                ) : (
                  <Markdown>{m.content}</Markdown>
                )}
                <SourcesDisclosure sources={m.sources} onJumpToMemory={onJumpToMemory} />
              </Bubble>
            );
          })}

          {loading && (
            // Same markup as the real assistant bubble's own empty-streaming
            // state below (m.streaming && !m.content) — this one is only on
            // screen for the pre-"meta" gap, before that bubble exists yet.
            // Matching it exactly means no visual jump at the handoff.
            <Bubble role="assistant">
              <span className="text-muted-foreground">ARIA is thinking…</span>
            </Bubble>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {scrolledFromTop && (
        <div className="scroll-fade-top pointer-events-none absolute inset-x-0 top-0 h-6" style={{ "--scroll-fade-bg": "var(--sidebar)" }} />
      )}
      {!scrolledToBottom && (
        <div className="scroll-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-6" style={{ "--scroll-fade-bg": "var(--sidebar)" }} />
      )}

      {thumb.height > 0 && (
        <div
          onPointerDown={handleThumbPointerDown}
          className={cn(
            "absolute -right-2 w-2 cursor-grab rounded-full bg-sidebar-scrollbar-thumb transition-opacity active:cursor-grabbing hover:bg-sidebar-scrollbar-thumb-hover",
            thumbActive ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          style={{ top: thumb.top, height: thumb.height }}
        />
      )}
    </div>
  );
}
