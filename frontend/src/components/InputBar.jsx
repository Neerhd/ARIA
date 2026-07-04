import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ACCEPTED = ".txt,.md,.pdf,.py,.js,.ts,.jsx,.tsx,.json,.csv,.html,.xml,.yaml,.yml,.sh,.sql,.toml,.rb,.go,.java,.c,.cpp,.h,.rs,.swift,.kt";

const TIER_VARIANTS = { 1: "tier1", 2: "tier2", 3: "tier3" };

const TOOL_ICONS = { web_search: "🔍", file_reader: "📂", file_writer: "💾" };

export default function InputBar({ onSend, disabled, routingMode, conversationTier, onTierChange, toolsEnabled = [] }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled) return;
    if (!text.trim() && !file) return;
    onSend(text, file);
    setText("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
  };

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0];
    if (picked) setFile(picked);
  };

  const removeFile = () => {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const canSend = !disabled && (text.trim() || file);

  return (
    <div className="border-t border-border bg-card">
      {/* Active tool pills */}
      {toolsEnabled.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pt-1.5">
          {toolsEnabled.map((t) => (
            <Badge key={t} variant="secondary">
              {TOOL_ICONS[t] || "🔧"} {t.replace("_", " ")}
            </Badge>
          ))}
        </div>
      )}

      {/* File attachment chip */}
      {file && (
        <div className="flex items-center gap-2 px-5 pt-1.5">
          <Badge variant="outline" className="gap-1.5 border-violet-600 text-violet-300">
            <span>📎</span>
            <span className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
              {file.name}
            </span>
            <button
              type="button"
              onClick={removeFile}
              className="cursor-pointer border-none bg-transparent p-0 text-sm leading-none text-muted-foreground"
            >
              ×
            </button>
          </Badge>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 px-5 pt-2.5 pb-3">
        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Manual tier selector */}
        {routingMode === "manual" && (
          <div className="flex shrink-0 gap-1">
            {[1, 2, 3].map((t) => {
              const active = conversationTier === t;
              return (
                <Badge
                  key={t}
                  variant={active ? TIER_VARIANTS[t] : "outline"}
                  render={<button type="button" disabled={disabled} />}
                  onClick={() => onTierChange(t)}
                  title={`Use Tier ${t}`}
                  className="cursor-pointer font-bold"
                >
                  T{t}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Auto/ask mode tier indicator */}
        {routingMode !== "manual" && conversationTier > 1 && (
          <Badge variant={TIER_VARIANTS[conversationTier]} className="shrink-0">
            T{conversationTier}
          </Badge>
        )}

        {/* Paperclip button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          title="Attach a file"
          className={`shrink-0 ${file ? "text-violet-400" : ""}`}
        >
          📎
        </Button>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={file ? "Add a question about the file, or send as-is…" : "Message ARIA… (Enter to send, Shift+Enter for new line)"}
          disabled={disabled}
          rows={1}
          className="min-h-0 flex-1 resize-none"
        />

        <Button
          type="submit"
          disabled={!canSend}
          className="shrink-0 bg-violet-600 text-white hover:bg-violet-700"
        >
          Send
        </Button>
      </form>
    </div>
  );
}
