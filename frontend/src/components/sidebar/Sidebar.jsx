import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import SidebarItem from "./SidebarItem";
import SidebarSection from "./SidebarSection";

const MIN_THUMB_HEIGHT = 24;
// Matches Tailwind's `md` breakpoint exactly, so the JS-driven bits (which
// icon/action the header button uses) switch at the same width as the
// `max-md:`/`md:` layout classes below.
const MOBILE_QUERY = "(max-width: 767.98px)";

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * Sidebar shell for the new design system, docked flush to the left edge
 * of the viewport (right border only — no floating-card treatment).
 *
 * Padding model (matches the Figma reference exactly): the container has a
 * single uniform 12px padding. The header row uses ONLY that — no padding
 * of its own. Regular items add their own 12px on top of it, so items sit
 * at 24px total while the header sits at 12px — that's deliberate, not a
 * mismatch to fix.
 *
 * The scrollbar is not a native reserved-space scrollbar at all — it's a
 * thin custom-drawn thumb that floats within the container's own outer
 * margin (the same margin the header sits in), tracking scroll position via
 * JS, rather than pushing item content over to make room for itself.
 *
 * Desktop (>=768px): normal in-flow sidebar. Expanded shows header + a
 * stack of SidebarSections; collapsed shows just the header thumbnail,
 * hover-swapped to the expand icon.
 *
 * Mobile (<768px): the sidebar takes up no layout space at all. A small
 * trigger button opens it as a fixed overlay sliding in from the left, with
 * a backdrop; the header's toggle button closes the overlay instead of
 * collapsing to icon mode, since icon-only doesn't make sense in a
 * temporary drawer.
 *
 * `navItems`: fixed, always-visible, non-collapsible list rendered between the
 * header and the scrollable sections (e.g. New Chat / Search / Graph /
 * Memory) — [{ id, label, icon, shortcut, onClick, active }]
 * `sections`: [{ id, title, items, emptyLabel }]
 * `items` (per section): [{ id, label, icon, selected, onClick, actions, children }]
 */
export default function Sidebar({
  className,
  logo,
  navItems = [],
  sections = [],
  collapsed = false,
  onCollapsedChange,
}) {
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0 });
  const [thumbActive, setThumbActive] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const effectiveCollapsed = isMobile ? false : collapsed;

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setIsScrolled(scrollTop > 0);
    if (scrollHeight <= clientHeight + 1) {
      setThumb({ top: 0, height: 0 });
      return;
    }
    const height = Math.max((clientHeight / scrollHeight) * clientHeight, MIN_THUMB_HEIGHT);
    const maxTop = clientHeight - height;
    const top = (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    setThumb({ top, height });
  }, []);

  useLayoutEffect(() => {
    updateThumb();
    // Observe the inner content wrapper, not the scroll container itself —
    // the container's own box is height-locked by the flex layout and never
    // resizes, so it never fires when content grows/shrinks (e.g. expanding
    // a project row, whose expand/collapse state lives locally in
    // SidebarTreeItem and never touches the `sections` prop here). The
    // content wrapper is unconstrained, so its natural height tracks actual
    // overflow correctly.
    const content = contentRef.current;
    if (!content) return;
    const ro = new ResizeObserver(updateThumb);
    ro.observe(content);
    return () => ro.disconnect();
  }, [updateThumb, sections]);

  const handleThumbPointerDown = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();

    const startY = e.clientY;
    const startScrollTop = el.scrollTop;
    const { scrollHeight, clientHeight } = el;
    const maxScrollTop = scrollHeight - clientHeight;
    const thumbHeight = Math.max((clientHeight / scrollHeight) * clientHeight, MIN_THUMB_HEIGHT);
    const maxThumbTop = clientHeight - thumbHeight;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const handleMove = (moveEvent) => {
      if (maxThumbTop <= 0) return;
      const deltaY = moveEvent.clientY - startY;
      const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;
      el.scrollTop = Math.min(Math.max(startScrollTop + scrollDelta, 0), maxScrollTop);
    };
    const handleUp = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, []);

  const handleHeaderToggle = () => {
    if (isMobile) {
      setMobileOpen(false);
    } else {
      onCollapsedChange?.(true);
    }
  };

  return (
    <>
      {isMobile && !mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open sidebar"
          title="Open sidebar"
          className="fixed top-3 left-3 z-40 flex size-9 items-center justify-center rounded-sidebar-md border border-sidebar-border bg-sidebar text-sidebar-muted-foreground shadow-sm outline-none hover:bg-sidebar-item-hover hover:text-sidebar-item-hover-foreground focus-visible:ring-2 focus-visible:ring-sidebar-muted-foreground"
        >
          <PanelLeftOpen className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}

      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "font-sidebar relative flex h-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar p-3 transition-[width] duration-150",
          effectiveCollapsed ? "w-14 items-center gap-1" : "w-[248px] gap-3",
          isMobile && "fixed inset-y-0 left-0 z-50 shadow-xl transition-transform duration-200",
          isMobile && (mobileOpen ? "translate-x-0" : "-translate-x-full"),
          className
        )}
      >
        {effectiveCollapsed ? (
          <>
            <button
              type="button"
              onClick={() => onCollapsedChange?.(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="group/thumb relative flex size-8 shrink-0 cursor-e-resize items-center justify-center rounded-sidebar-md outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-muted-foreground"
            >
              <span className="transition-opacity group-hover/thumb:opacity-0 group-focus-visible/thumb:opacity-0">
                {logo}
              </span>
              <span className="absolute inset-0 flex items-center justify-center text-sidebar-muted-foreground opacity-0 transition-opacity group-hover/thumb:opacity-100 group-focus-visible/thumb:opacity-100">
                <PanelLeftOpen className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
              </span>
            </button>

            {navItems.length > 0 && (
              <div className="flex shrink-0 flex-col items-center gap-0.5">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    aria-label={item.label}
                    title={item.label}
                    aria-current={item.active ? "true" : undefined}
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-sidebar-md outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-muted-foreground",
                      item.active
                        ? "bg-sidebar-item-active text-sidebar-item-active-foreground"
                        : "text-sidebar-muted-foreground hover:bg-sidebar-item-hover hover:text-sidebar-item-hover-foreground"
                    )}
                  >
                    <item.icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between gap-1.5 px-3">
              {logo}
              <button
                type="button"
                onClick={handleHeaderToggle}
                aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
                title={isMobile ? "Close sidebar" : "Collapse sidebar"}
                className={cn(
                  "flex size-[30px] shrink-0 items-center justify-center rounded-sidebar-md text-sidebar-muted-foreground outline-none hover:bg-sidebar-item-hover hover:text-sidebar-item-hover-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-muted-foreground",
                  !isMobile && "cursor-w-resize"
                )}
              >
                {isMobile ? (
                  <X className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                )}
              </button>
            </div>

            {navItems.length > 0 && (
              <div
                className={cn(
                  "flex shrink-0 flex-col gap-0.5 transition-[border-color]",
                  isScrolled ? "border-b border-sidebar-border" : "border-b border-transparent"
                )}
              >
                {navItems.map((item) => (
                  <SidebarItem
                    key={item.id}
                    label={item.label}
                    icon={item.icon}
                    shortcut={item.shortcut}
                    selected={item.active}
                    onClick={item.onClick}
                  />
                ))}
              </div>
            )}

            <div
              className="relative min-h-0 flex-1"
              onMouseEnter={() => setThumbActive(true)}
              onMouseLeave={() => setThumbActive(false)}
            >
              <div
                ref={scrollRef}
                onScroll={updateThumb}
                className={cn("sidebar-scroll-hidden h-full overflow-y-auto", thumb.height > 0 && "pr-1.5")}
              >
                <div ref={contentRef} className="flex flex-col gap-3">
                  {sections.map((section) => (
                    <SidebarSection
                      key={section.id}
                      title={section.title}
                      items={section.items}
                      emptyLabel={section.emptyLabel}
                      actions={section.actions}
                    />
                  ))}
                </div>
              </div>
              <div className="sidebar-scroll-fade pointer-events-none absolute inset-x-0 bottom-0 h-6" />

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
          </>
        )}
      </aside>
    </>
  );
}
