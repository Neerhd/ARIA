import { useLayoutEffect, useRef, useState } from "react";
import Button from "../button/Button";
import Tooltip from "../tooltip/Tooltip";
import { cn } from "@/lib/utils";

/**
 * Design-system message bubble. User messages get a filled shell (same gray
 * as the secondary button's enabled state) that's a true pill while the
 * text fits on one line, relaxing to a fixed rounded-bubble radius once it
 * wraps — same reasoning as InputBar's pill/rounded-input switch, since
 * rounded-full stops reading as "pill" and starts reading as a squared-off
 * box once the box gets taller than it is round. ARIA replies render with
 * no fill at all. Both reveal a row of small "clean" icon buttons
 * underneath on hover/focus — `actions` is the same {icon, label, onClick}
 * shape Sidebar item actions already use.
 */
export default function Bubble({ role, timestamp, actions = [], children, className }) {
  const isUser = role === "user";
  const hasFooter = (isUser && timestamp) || actions.length > 0;
  const contentRef = useRef(null);
  const [isMultiline, setIsMultiline] = useState(false);

  useLayoutEffect(() => {
    if (!isUser) return;
    const el = contentRef.current;
    if (!el) return;

    const checkWrap = () => {
      const style = getComputedStyle(el);
      const singleLineHeight = parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      setIsMultiline(el.offsetHeight > singleLineHeight + 2);
    };

    checkWrap();
    const observer = new ResizeObserver(checkWrap);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isUser, children]);

  return (
    <div className={cn("group/bubble flex w-full flex-col", isUser ? "items-end" : "items-stretch")}>
      <div
        ref={isUser ? contentRef : undefined}
        className={cn(
          "font-sidebar text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? cn("max-w-[70%] bg-bubble px-4 py-2.5 text-bubble-foreground", isMultiline ? "rounded-bubble" : "rounded-full")
            : "w-full text-foreground",
          className
        )}
      >
        {children}
      </div>

      {hasFooter && (
        <div
          className={cn(
            "mt-1 flex items-center gap-0.5 opacity-0 transition-opacity",
            "focus-within:opacity-100 group-hover/bubble:opacity-100",
            isUser ? "px-2" : "px-0"
          )}
        >
          {isUser && timestamp && (
            <span className="font-sidebar mr-1 text-xs text-muted-foreground">{timestamp}</span>
          )}
          {actions.map(({ icon, label, onClick }) => (
            <Tooltip key={label} label={label} side="bottom">
              <Button variant="clean" size="small" icon={icon} onClick={onClick} aria-label={label} />
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}
