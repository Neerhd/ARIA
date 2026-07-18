import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw } from "lucide-react";
import Button from "../button/Button";
import Tooltip from "../tooltip/Tooltip";

/**
 * Retry action for assistant replies — click reveals a tiny floating menu of
 * models instead of silently re-routing, so a specific model can be forced
 * for one retry ("Auto" re-routes normally). One-shot only — the next
 * message routes fresh as usual. Portals + positions like Tooltip, since
 * it's the same "float outside any clipping ancestor" need.
 */
export default function RetryModelMenu({ options = [], onRetry }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const toggle = () => {
    if (!open) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!triggerRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const entries = [{ provider: null, model: null, label: "Auto" }, ...options];

  return (
    <>
      <Tooltip label="Retry" side="bottom">
        <Button ref={triggerRef} variant="clean" size="small" icon={RotateCcw} onClick={toggle} aria-label="Retry" />
      </Tooltip>
      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: coords.top, left: coords.left }}
            className="font-sidebar z-50 flex flex-col gap-0.5 rounded-button border border-tooltip-border bg-tooltip p-1 shadow-sm"
          >
            {entries.map((opt) => (
              <button
                key={opt.model ? `${opt.provider}:${opt.model}` : "auto"}
                type="button"
                onClick={() => {
                  onRetry(opt.model ? { provider: opt.provider, model: opt.model } : null);
                  setOpen(false);
                }}
                className="cursor-pointer rounded-button px-2 py-1 text-left text-xs font-bold text-tooltip-foreground outline-none hover:bg-white/10"
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
