import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_SIZE = { default: "size-[18px]", small: "size-[15px]" };
const TEXT_SIZE = { default: "text-sm", small: "text-xs" };

const VARIANT_CLASSES = {
  primary:
    "bg-button-primary text-white hover:bg-button-primary-hover active:bg-button-primary-pressed disabled:bg-button-primary-disabled",
  secondary:
    "border border-button-secondary-border bg-button-secondary text-button-secondary-foreground hover:bg-button-secondary-hover active:bg-button-secondary-pressed active:text-button-secondary-pressed-foreground disabled:border-button-secondary-border-disabled disabled:bg-button-secondary-disabled disabled:text-button-secondary-disabled-foreground",
  clean:
    "bg-transparent text-button-clean-foreground hover:bg-button-clean-hover active:bg-button-clean-pressed active:text-button-clean-pressed-foreground disabled:text-button-clean-disabled-foreground",
};

/**
 * Design-system Button — leading icon (optional) + label (optional) +
 * dropdown chevron (optional), but at least one of icon/label must be given.
 * Padding follows the Figma spec's three shapes: icon-only gets 8px on every
 * side, a dropdown trigger gets 8px only on the right (12px elsewhere), and
 * everything else gets the regular 12px/8px.
 */
const Button = forwardRef(function Button(
  {
    variant = "secondary",
    size = "default",
    icon: Icon,
    dropdown = false,
    disabled = false,
    className,
    children,
    ...props
  },
  ref
) {
  if (process.env.NODE_ENV !== "production" && !Icon && !children) {
    console.warn("Button: provide an `icon` and/or children (label) — a button can't have neither.");
  }

  const iconOnly = !children;

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={cn(
        "font-sidebar inline-flex shrink-0 items-center justify-center gap-1 rounded-button font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-muted-foreground disabled:pointer-events-none",
        VARIANT_CLASSES[variant],
        TEXT_SIZE[size],
        dropdown ? "py-2 pr-2 pl-3" : iconOnly ? "p-2" : "px-3 py-2",
        className
      )}
      {...props}
    >
      {Icon && <Icon className={cn(ICON_SIZE[size], "shrink-0")} strokeWidth={1.75} aria-hidden="true" />}
      {children && <span className="whitespace-nowrap">{children}</span>}
      {dropdown && <ChevronDown className={cn(ICON_SIZE[size], "shrink-0")} strokeWidth={1.75} aria-hidden="true" />}
    </button>
  );
});

export default Button;
