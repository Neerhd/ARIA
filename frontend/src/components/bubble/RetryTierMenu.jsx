import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw } from "lucide-react";
import Button from "../button/Button";
import Tooltip from "../tooltip/Tooltip";

const TIERS = [1, 2, 3];

/**
 * Retry action for assistant replies — click reveals a tiny floating T1/T2/T3
 * choice instead of silently re-classifying, so a specific tier can be
 * forced for one retry (same one-shot override_tier mechanism the ask-mode
 * confirm/decline flow already uses). Portals + positions like Tooltip,
 * since it's the same "float outside any clipping ancestor" need.
 */
export default function RetryTierMenu({ onRetry }) {
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
            className="font-sidebar z-50 flex gap-0.5 rounded-button border border-tooltip-border bg-tooltip p-1 shadow-sm"
          >
            {TIERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onRetry(t);
                  setOpen(false);
                }}
                className="cursor-pointer rounded-button px-2 py-1 text-xs font-bold text-tooltip-foreground outline-none hover:bg-white/10"
              >
                T{t}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
