import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { Paperclip, Plus, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "../button/Button";
import Tooltip from "../tooltip/Tooltip";
import { useScrollThumb } from "../../hooks/useScrollThumb";

const ACCEPTED = ".txt,.md,.pdf,.py,.js,.ts,.jsx,.tsx,.json,.csv,.html,.xml,.yaml,.yml,.sh,.sql,.toml,.rb,.go,.java,.c,.cpp,.h,.rs,.swift,.kt";

/**
 * The message composer — a single self-contained field (bg-background,
 * border reusing the secondary button's tone) shared by both the New Chat
 * page and active conversations. The page decides placement (centered vs
 * docked); this component only owns the field and its row of controls.
 * Pill-shaped while single-line, relaxing to rounded-input once it grows.
 */
export default function InputBar({ onSend, disabled, routingMode, manualModel, onManualModelChange, modelOptions = [], isFollowUp = false, prefillText, prefillKey }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [isMultiline, setIsMultiline] = useState(false);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const baselineHeightRef = useRef(null);

  // No contentRef here (unlike Sidebar) — a textarea has no separate inner
  // content wrapper to observe, and once it hits max-height its own box stops
  // resizing even as content keeps growing, so `update()` is also called
  // manually below whenever `text` changes rather than relying solely on the
  // ResizeObserver.
  const {
    thumb,
    active: thumbActive,
    setActive: setThumbActive,
    scrolledFromTop,
    scrolledToBottom,
    update: updateThumb,
    handlePointerDown: handleThumbPointerDown,
  } = useScrollThumb(textareaRef);

  // Pill-shaped while the field is a single line; once it grows (wrapped
  // text or an explicit newline) it relaxes to the normal rounded corners —
  // a pill doesn't read well once the box is taller than it is round.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (baselineHeightRef.current == null) baselineHeightRef.current = el.offsetHeight;

    const observer = new ResizeObserver(() => {
      setIsMultiline(el.offsetHeight > baselineHeightRef.current + 2);
      updateThumb();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateThumb]);

  useEffect(() => {
    updateThumb();
  }, [text, updateThumb]);

  // Editing a sent message drops its text back into the composer — keyed on
  // prefillKey (not prefillText) so re-editing the same message still refires.
  useEffect(() => {
    if (prefillKey == null) return;
    setText(prefillText || "");
    textareaRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

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
              className="flex shrink-0 cursor-pointer items-center justify-center outline-none"
            >
              <X className="size-3" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Manual mode's standing model pick — a per-conversation-session
          preference, not a per-message one-shot (that's the retry menu).
          Clicking the active pill deselects it, falling back to the
          backend's default model. */}
      {routingMode === "manual" && modelOptions.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1 pb-2">
          {modelOptions.map((opt) => {
            const active = manualModel?.provider === opt.provider && manualModel?.model === opt.model;
            return (
              <button
                key={`${opt.provider}:${opt.model}`}
                type="button"
                disabled={disabled}
                onClick={() => onManualModelChange(active ? null : opt)}
                aria-pressed={active}
                className={cn(
                  "font-sidebar flex h-6 cursor-pointer items-center justify-center rounded-button px-2 text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
                  active
                    ? "border border-input-border text-input-foreground"
                    : "text-muted-foreground hover:bg-button-clean-hover"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex gap-1.5 border border-input-border bg-background p-2 shadow-sm",
          isMultiline ? "items-end rounded-input" : "items-center rounded-full"
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

        <div
          className="relative min-w-0 flex-1"
          onMouseEnter={() => setThumbActive(true)}
          onMouseLeave={() => setThumbActive(false)}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onScroll={updateThumb}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "scroll-hidden field-sizing-content font-sidebar block max-h-32 min-h-0 w-full resize-none border-0 bg-transparent px-1.5 py-0 text-sm leading-5 text-input-foreground outline-none placeholder:text-input-placeholder disabled:cursor-not-allowed disabled:opacity-50 sm:max-h-40 md:max-h-52",
              thumb.height > 0 && "pr-2.5"
            )}
          />

          {scrolledFromTop && (
            <div
              className="scroll-fade-top pointer-events-none absolute inset-x-0 top-0 h-4"
              style={{ "--scroll-fade-bg": "var(--background)" }}
            />
          )}
          {!scrolledToBottom && (
            <div
              className="scroll-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-4"
              style={{ "--scroll-fade-bg": "var(--background)" }}
            />
          )}

          {thumb.height > 0 && (
            <div
              onPointerDown={handleThumbPointerDown}
              className={cn(
                "absolute right-0.5 w-1.5 cursor-grab rounded-full bg-sidebar-scrollbar-thumb transition-opacity active:cursor-grabbing hover:bg-sidebar-scrollbar-thumb-hover",
                thumbActive ? "opacity-100" : "pointer-events-none opacity-0"
              )}
              style={{ top: thumb.top, height: thumb.height }}
            />
          )}
        </div>

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
