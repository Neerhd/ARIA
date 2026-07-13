import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// Full Tailwind hue palette at fixed shades — bg-950 (reads the same in
// light/dark, so no theme-driven token), hover-900, icon-200. Label color is
// always white regardless of hue, per spec. hoverBg is only ever applied to
// clickable badges (see below) — a color shift on hover reads as "this is
// interactive," so showing it on a purely informational badge is both
// misleading and, in practice, too subtle a shift to register as feedback
// for anything that isn't in the pointer's face.
const COLOR_CLASSES = {
  red: { bg: "bg-red-950", hoverBg: "hover:bg-red-900", icon: "text-red-200" },
  orange: { bg: "bg-orange-950", hoverBg: "hover:bg-orange-900", icon: "text-orange-200" },
  amber: { bg: "bg-amber-950", hoverBg: "hover:bg-amber-900", icon: "text-amber-200" },
  yellow: { bg: "bg-yellow-950", hoverBg: "hover:bg-yellow-900", icon: "text-yellow-200" },
  lime: { bg: "bg-lime-950", hoverBg: "hover:bg-lime-900", icon: "text-lime-200" },
  green: { bg: "bg-green-950", hoverBg: "hover:bg-green-900", icon: "text-green-200" },
  emerald: { bg: "bg-emerald-950", hoverBg: "hover:bg-emerald-900", icon: "text-emerald-200" },
  teal: { bg: "bg-teal-950", hoverBg: "hover:bg-teal-900", icon: "text-teal-200" },
  cyan: { bg: "bg-cyan-950", hoverBg: "hover:bg-cyan-900", icon: "text-cyan-200" },
  sky: { bg: "bg-sky-950", hoverBg: "hover:bg-sky-900", icon: "text-sky-200" },
  blue: { bg: "bg-blue-950", hoverBg: "hover:bg-blue-900", icon: "text-blue-200" },
  indigo: { bg: "bg-indigo-950", hoverBg: "hover:bg-indigo-900", icon: "text-indigo-200" },
  violet: { bg: "bg-violet-950", hoverBg: "hover:bg-violet-900", icon: "text-violet-200" },
  purple: { bg: "bg-purple-950", hoverBg: "hover:bg-purple-900", icon: "text-purple-200" },
  fuchsia: { bg: "bg-fuchsia-950", hoverBg: "hover:bg-fuchsia-900", icon: "text-fuchsia-200" },
  pink: { bg: "bg-pink-950", hoverBg: "hover:bg-pink-900", icon: "text-pink-200" },
  rose: { bg: "bg-rose-950", hoverBg: "hover:bg-rose-900", icon: "text-rose-200" },
};

/**
 * Design-system badge — optional leading icon, optional leading/trailing
 * avatar (pass an Avatar or AvatarStack at size="s"), a label, in that
 * order. `color` picks a hue from the full Tailwind palette; bg is always
 * that hue's 950 shade, the icon is always its 200 shade, and the label is
 * always white — none of that varies with light/dark mode. Only shifts to
 * the 900 shade on hover when `onClick` is given, since hover feedback on a
 * non-interactive label is both misleading and, in practice, imperceptible.
 * Renders a <button> instead of a <span> when `onClick` is given.
 */
const Badge = forwardRef(function Badge(
  { color = "purple", icon: Icon, leadingAvatar, trailingAvatar, children, onClick, className, ...props },
  ref
) {
  const Tag = onClick ? "button" : "span";
  const { bg, hoverBg, icon } = COLOR_CLASSES[color] || COLOR_CLASSES.purple;

  return (
    <Tag
      ref={ref}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "font-sidebar inline-flex w-fit shrink-0 items-center gap-1 rounded-badge px-2 py-1 text-xs font-normal whitespace-nowrap text-white transition-colors",
        bg,
        onClick && cn(hoverBg, "cursor-pointer"),
        className
      )}
      {...props}
    >
      {Icon && <Icon className={cn("size-3 shrink-0", icon)} strokeWidth={1.75} aria-hidden="true" />}
      {leadingAvatar}
      <span className="min-w-0 truncate">{children}</span>
      {trailingAvatar}
    </Tag>
  );
});

export default Badge;
