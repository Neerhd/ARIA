import { useState, useRef, useLayoutEffect } from "react";
import { Paperclip, Plus, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "../button/Button";
import Tooltip from "../tooltip/Tooltip";

const ACCEPTED = ".txt,.md,.pdf,.py,.js,.ts,.jsx,.tsx,.json,.csv,.html,.xml,.yaml,.yml,.sh,.sql,.toml,.rb,.go,.java,.c,.cpp,.h,.rs,.swift,.kt";

// Traffic-light semantics for routing tiers — cheap/fast to expensive/heavy.
const TIER_TEXT_COLOR = {
  1: "text-green-600 dark:text-green-400",
  2: "text-input-foreground",
  3: "text-red-600 dark:text-red-400",
};

/**
 * The message composer — a single self-contained field (bg-background,
 * border reusing the secondary button's tone) shared by both the New Chat
 * page and active conversations. The page decides placement (centered vs
 * docked); this component only owns the field and its row of controls.
 * Pill-shaped while single-line, relaxing to rounded-input once it grows.
 */
export default function InputBar({ onSend, disabled, routingMode, conversationTier, onTierChange, isFollowUp = false }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [isMultiline, setIsMultiline] = useState(false);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const baselineHeightRef = useRef(null);

  // Pill-shaped while the field is a single line; once it grows (wrapped
  // text or an explicit newline) it relaxes to the normal rounded corners —
  // a pill doesn't read well once the box is taller than it is round.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (baselineHeightRef.current == null) baselineHeightRef.current = el.offsetHeight;

    const observer = new ResizeObserver(() => {
      setIsMultiline(el.offsetHeight > baselineHeightRef.current + 2);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
  const placeholder = file
    ? "Add a question about the file, or send as-is…"
    : isFollowUp
      ? "Ask follow up"
      : "Ask anything";

  return (
    <div className="w-full">
      {/* File attachment chip — only present once a file is actually picked */}
      {file && (
        <div className="flex items-center gap-2 pb-2">
          <div className="font-sidebar inline-flex items-center gap-1.5 rounded-button border border-button-primary px-2.5 py-1 text-xs font-medium text-button-primary">
            <Paperclip className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="max-w-[200px] truncate">{file.name}</span>
            <button
              type="button"
              onClick={removeFile}
              aria-label="Remove attachment"
              className="flex shrink-0 items-center justify-center outline-none"
            >
              <X className="size-3" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Manual tier selector — only present in manual routing mode */}
      {routingMode === "manual" && (
        <div className="flex shrink-0 gap-1 pb-2">
          {[1, 2, 3].map((t) => {
            const active = conversationTier === t;
            return (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => onTierChange(t)}
                aria-label={`Use Tier ${t}`}
                aria-pressed={active}
                className={cn(
                  "font-sidebar flex h-6 items-center justify-center rounded-button px-2 text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-muted-foreground disabled:pointer-events-none disabled:opacity-50",
                  active
                    ? cn("border border-input-border", TIER_TEXT_COLOR[t])
                    : "text-muted-foreground hover:bg-button-clean-hover"
                )}
              >
                T{t}
              </button>
            );
          })}
        </div>
      )}

      {/* Auto/ask mode tier indicator — only present when the router picked above T1 */}
      {routingMode !== "manual" && conversationTier > 1 && (
        <div className="pb-2">
          <span
            className={cn(
              "font-sidebar inline-flex h-6 items-center rounded-button border border-input-border px-2 text-xs font-bold",
              TIER_TEXT_COLOR[conversationTier]
            )}
          >
            T{conversationTier}
          </span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex items-end gap-1.5 border border-input-border bg-background p-2 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-inset focus-within:ring-sidebar-muted-foreground",
          isMultiline ? "rounded-input" : "rounded-full"
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          onChange={handleFileChange}
          className="hidden"
        />

        <Tooltip label="Attach files or tools" side="top">
          <Button
            type="button"
            variant="clean"
            size="small"
            icon={Plus}
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            aria-label="Attach files or tools"
            className={cn("rounded-full", file && "text-button-primary")}
          />
        </Tooltip>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="field-sizing-content font-sidebar min-h-0 flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-sm text-input-foreground outline-none placeholder:text-input-placeholder disabled:cursor-not-allowed disabled:opacity-50"
        />

        <Button
          type="submit"
          variant="primary"
          icon={ArrowRight}
          disabled={!canSend}
          aria-label="Send message"
          className="rounded-full"
        />
      </form>
    </div>
  );
}
