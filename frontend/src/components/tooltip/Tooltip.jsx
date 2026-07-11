import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 8; // px between trigger and bubble
const DEFAULT_DELAY = 400;

/**
 * Wraps a single trigger element (must accept a ref and forward DOM event
 * props) and shows a floating label bubble on hover/focus. Portals to
 * document.body so it isn't clipped by an ancestor's overflow:hidden (e.g.
 * the collapsed sidebar), and positions itself from the trigger's live
 * bounding rect rather than reserving layout space.
 */
export default function Tooltip({ children, label, icon: Icon, shortcut, side = "top", delay = DEFAULT_DELAY }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const showTimer = useRef(null);
  const tooltipId = useId();

  const clearShowTimer = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  };

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let top, left, transform;
    switch (side) {
      case "bottom":
        top = rect.bottom + GAP;
        left = rect.left + rect.width / 2;
        transform = "translateX(-50%)";
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - GAP;
        transform = "translate(-100%, -50%)";
        break;
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + GAP;
        transform = "translateY(-50%)";
        break;
      case "top":
      default:
        top = rect.top - GAP;
        left = rect.left + rect.width / 2;
        transform = "translate(-50%, -100%)";
    }
    setCoords({ top, left, transform });
  }, [side]);

  const show = (immediate = false) => {
    if (!label) return;
    clearShowTimer();
    if (immediate) {
      updatePosition();
      setVisible(true);
    } else {
      showTimer.current = setTimeout(() => {
        updatePosition();
        setVisible(true);
      }, delay);
    }
  };

  const hide = () => {
    clearShowTimer();
    setVisible(false);
  };

  useEffect(() => clearShowTimer, []);

  useLayoutEffect(() => {
    if (!visible) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [visible, updatePosition]);

  const trigger = cloneElement(children, {
    ref: (node) => {
      triggerRef.current = node;
      const { ref } = children;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    "aria-describedby": label ? tooltipId : children.props["aria-describedby"],
    onMouseEnter: (e) => {
      children.props.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e) => {
      children.props.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e) => {
      children.props.onFocus?.(e);
      show(true);
    },
    onBlur: (e) => {
      children.props.onBlur?.(e);
      hide();
    },
    onKeyDown: (e) => {
      children.props.onKeyDown?.(e);
      if (e.key === "Escape") hide();
    },
  });

  return (
    <>
      {trigger}
      {visible &&
        coords &&
        createPortal(
          <div
            role="tooltip"
            id={tooltipId}
            style={{ position: "fixed", top: coords.top, left: coords.left, transform: coords.transform }}
            className="font-sidebar pointer-events-none z-50 inline-flex items-center gap-1 rounded-sidebar-sm border border-tooltip-border bg-tooltip px-3 py-1 shadow-sm"
          >
            <span className="flex min-w-0 flex-1 items-center gap-1">
              {Icon && (
                <Icon className="size-[14px] shrink-0 text-tooltip-foreground" strokeWidth={1.75} aria-hidden="true" />
              )}
              <span className="text-tooltip-foreground whitespace-nowrap text-xs font-medium tracking-[-0.48px]">
                {label}
              </span>
            </span>
            {shortcut && (
              <span className="text-tooltip-muted-foreground whitespace-nowrap text-xs tracking-[-0.48px]">
                {shortcut}
              </span>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
