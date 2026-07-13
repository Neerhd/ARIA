import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = { s: "size-4", m: "size-6", l: "size-10" };
const TEXT_SIZE_CLASSES = { s: "text-[10px]", m: "text-[14px]", l: "text-[20px]" };
const ICON_SIZE_CLASSES = { s: "size-[10px]", m: "size-[14px]", l: "size-[18px]" };
const RADIUS_CLASSES = { s: "rounded-avatar-sm", m: "rounded-avatar-md", l: "rounded-avatar-lg" };

/**
 * Design-system avatar — three variants (initials text, an image via `src`,
 * or a lucide `icon`), two shapes (rounded/circle), three sizes (s/m/l). No
 * border, by design. Unfilled (no src, no icon, no initials) just renders
 * the plain neutral swatch, matching the Figma reference's empty "Content"
 * cells.
 */
const Avatar = forwardRef(function Avatar(
  { shape = "rounded", size = "m", variant = "text", initials, icon: Icon, src, alt = "", className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "font-sidebar relative flex shrink-0 items-center justify-center overflow-hidden bg-avatar",
        SIZE_CLASSES[size],
        shape === "circle" ? "rounded-full" : RADIUS_CLASSES[size],
        className
      )}
      {...props}
    >
      {variant === "content" && src && (
        <img src={src} alt={alt} className="size-full object-cover" />
      )}
      {variant === "icon" && Icon && (
        <Icon className={cn(ICON_SIZE_CLASSES[size], "text-avatar-foreground")} strokeWidth={1.75} aria-hidden="true" />
      )}
      {variant === "text" && initials && (
        <span className={cn("font-bold whitespace-nowrap text-avatar-foreground", TEXT_SIZE_CLASSES[size])}>
          {initials}
        </span>
      )}
    </div>
  );
});

export default Avatar;
