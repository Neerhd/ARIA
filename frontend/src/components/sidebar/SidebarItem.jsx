import { forwardRef } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Base row for the new (non-shadcn) Sidebar design system.
 * Used directly for chats, and for section headers (variant="header").
 *
 * Structured as a non-interactive row containing a real <button> for
 * selection and, as siblings (not descendants), real <button>s for the
 * optional hover actions — nesting interactive elements inside a <button>
 * is invalid HTML and breaks screen-reader/keyboard behavior.
 */
const SidebarItem = forwardRef(function SidebarItem(
  {
    className,
    label,
    icon: Icon,
    variant = "default", // "default" | "header"
    selected = false,
    expandable = false,
    expanded = false,
    actions = [], // [{ icon: LucideIcon, label: string, onClick: fn }, ...] — max 2
    shortcut, // e.g. "⌘K" — always visible, unlike hover-only actions
    interactive = true, // false for purely informational rows (e.g. empty state)
    onClick,
    ...props
  },
  ref
) {
  const isHeader = variant === "header";
  const Tag = interactive ? "button" : "div";

  return (
    <div
      className={cn(
        "group/sidebar-item relative flex h-9 w-full shrink-0 items-center gap-1.5 rounded-sidebar-md px-3",
        selected
          ? "bg-sidebar-item-active text-sidebar-item-active-foreground"
          : isHeader
            ? "text-sidebar-section-foreground hover:bg-sidebar-item-hover hover:text-sidebar-item-hover-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-item-hover hover:text-sidebar-item-hover-foreground",
        isHeader && "font-medium",
        className
      )}
    >
      <Tag
        ref={ref}
        type={interactive ? "button" : undefined}
        onClick={interactive ? onClick : undefined}
        aria-current={interactive && selected ? "true" : undefined}
        aria-expanded={interactive && expandable ? expanded : undefined}
        className={cn(
          "font-sidebar flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-sidebar-md text-left text-sm",
          interactive ? "outline-none" : "cursor-default",
          interactive && "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-muted-foreground"
        )}
        {...props}
      >
        {Icon && <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />}

        <span className="min-w-0 flex-1 truncate">{label}</span>
      </Tag>

      {shortcut && (
        <span
          aria-hidden="true"
          className="shrink-0 pr-1 font-mono text-[11px] tracking-tight text-sidebar-muted-foreground"
        >
          {shortcut}
        </span>
      )}

      {interactive && actions.length > 0 && (
        <span className="hidden shrink-0 items-center gap-1 group-hover/sidebar-item:flex group-has-[:focus-visible]/sidebar-item:flex">
          {actions.slice(0, 2).map((action, i) => (
            <button
              key={i}
              type="button"
              aria-label={action.label}
              title={action.label}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick?.(e);
              }}
              className="flex size-[18px] items-center justify-center rounded text-sidebar-muted-foreground outline-none hover:text-sidebar-item-hover-foreground focus-visible:ring-2 focus-visible:ring-sidebar-muted-foreground"
            >
              <action.icon className="size-[14px]" strokeWidth={1.75} aria-hidden="true" />
            </button>
          ))}
        </span>
      )}

      {expandable && (
        <button
          type="button"
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(e);
          }}
          className={cn(
            "flex size-[18px] shrink-0 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-sidebar-muted-foreground",
            isHeader ? "text-sidebar-section-foreground" : "text-sidebar-muted-foreground"
          )}
        >
          {expanded ? (
            <ChevronDown className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <ChevronRight className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
});

export default SidebarItem;
