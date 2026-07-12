import { useEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import SidebarItem from "./SidebarItem";
import SidebarSection from "./SidebarSection";
import Tooltip from "../tooltip/Tooltip";
import Button from "../button/Button";
import { useScrollThumb } from "../../hooks/useScrollThumb";

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
  const {
    thumb,
    active: thumbActive,
    setActive: setThumbActive,
    scrolledFromTop: isScrolled,
    update: updateThumb,
    handlePointerDown: handleThumbPointerDown,
  } = useScrollThumb(scrollRef, contentRef);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const effectiveCollapsed = isMobile ? false : collapsed;

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
        <Tooltip label="Open sidebar" side="right">
          <Button
            variant="clean"
            icon={PanelLeftOpen}
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
            className="fixed top-3 left-3 z-40"
          />
        </Tooltip>
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
            <Tooltip label="Expand sidebar" side="right">
              <button
                type="button"
                onClick={() => onCollapsedChange?.(false)}
                aria-label="Expand sidebar"
                className="group/thumb relative flex size-8 shrink-0 cursor-e-resize items-center justify-center rounded-sidebar-md outline-none hover:bg-sidebar-item-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-muted-foreground"
              >
                <span className="transition-opacity group-hover/thumb:opacity-0 group-focus-visible/thumb:opacity-0">
                  {logo}
                </span>
                <span className="absolute inset-0 flex items-center justify-center text-sidebar-muted-foreground opacity-0 transition-opacity group-hover/thumb:opacity-100 group-focus-visible/thumb:opacity-100">
                  <PanelLeftOpen className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                </span>
              </button>
            </Tooltip>

            {navItems.length > 0 && (
              <div className="flex shrink-0 flex-col items-center gap-0.5">
                {navItems.map((item) => (
                  <Tooltip key={item.id} label={item.label} shortcut={item.shortcut} side="right">
                    <Button
                      variant="clean"
                      icon={item.icon}
                      onClick={item.onClick}
                      aria-label={item.label}
                      aria-current={item.active ? "true" : undefined}
                      className={
                        item.active
                          ? "bg-sidebar-item-active text-sidebar-item-active-foreground hover:bg-sidebar-item-active hover:text-sidebar-item-active-foreground"
                          : ""
                      }
                    />
                  </Tooltip>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between gap-1.5 px-3">
              {logo}
              <Tooltip label={isMobile ? "Close sidebar" : "Collapse sidebar"} side="bottom">
                <Button
                  variant="clean"
                  icon={isMobile ? X : PanelLeftClose}
                  onClick={handleHeaderToggle}
                  aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
                  className={cn(!isMobile && "cursor-w-resize")}
                />
              </Tooltip>
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
                className={cn("scroll-hidden h-full overflow-y-auto", thumb.height > 0 && "pr-1.5")}
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
              {isScrolled && (
                <div
                  className="scroll-fade-top pointer-events-none absolute inset-x-0 top-0 h-6"
                  style={{ "--scroll-fade-bg": "var(--sidebar)" }}
                />
              )}
              <div
                className="scroll-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-6"
                style={{ "--scroll-fade-bg": "var(--sidebar)" }}
              />

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
