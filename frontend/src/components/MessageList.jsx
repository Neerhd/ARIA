import { useEffect, useRef } from "react";
import ModelBadge from "./ModelBadge";
import RoutingPrompt from "./RoutingPrompt";
import { Badge } from "@/components/ui/badge";

export default function MessageList({ messages, loading, onRoutingDecision }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: "#4a5568", fontSize: 15,
      }}>
        Say something to get started.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
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
          <div key={m.id} style={{
            display: "flex",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: "72%", padding: "12px 16px", borderRadius: 12,
              background: m.role === "user" ? "#7c3aed" : "#1e1e2e",
              color: "#e2e8f0", fontSize: 14, lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>
              {m.role === "assistant" && (
                <div style={{ fontSize: 10, color: "#7c3aed", marginBottom: 4, fontWeight: 700 }}>ARIA</div>
              )}
              {m.file_name && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: "rgba(255,255,255,0.1)", borderRadius: 5,
                  padding: "2px 8px", fontSize: 11, marginBottom: 6,
                }}>
                  📎 {m.file_name}
                  {m.truncated && <span style={{ color: "#fbbf24" }}> (truncated)</span>}
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
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <div style={{
            padding: "12px 16px", borderRadius: 12, background: "#1e1e2e",
            color: "#7c3aed", fontSize: 14,
          }}>
            <span>ARIA is thinking…</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
