import Avatar from "./Avatar";
import { cn } from "@/lib/utils";

const OVERLAP_CLASSES = { s: "-ml-1", m: "-ml-1.5", l: "-ml-3" };
const RING_WIDTH_CLASSES = { s: "ring-1", m: "ring-2", l: "ring-2" };

/**
 * A row of overlapping Avatars — for message sources, collaborators, etc.
 * Unlike a lone Avatar (deliberately borderless), stacked avatars need a
 * ring in the surrounding surface color or directly-overlapping same-fill
 * circles blend into an unreadable blob; `ringClassName` lets a consumer
 * match whatever surface it's dropped onto (defaults to the app background).
 * Entries beyond `max` collapse into a trailing "+N" Avatar.
 */
export default function AvatarStack({ avatars = [], size = "m", shape = "circle", max = 4, ringClassName = "ring-background", className }) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - visible.length;

  return (
    <div className={cn("isolate flex items-center", className)}>
      {visible.map((avatar, i) => (
        <Avatar
          key={avatar.key ?? i}
          {...avatar}
          shape={avatar.shape ?? shape}
          size={size}
          style={{ zIndex: visible.length - i }}
          className={cn(RING_WIDTH_CLASSES[size], ringClassName, i > 0 && OVERLAP_CLASSES[size])}
        />
      ))}
      {overflow > 0 && (
        <Avatar
          variant="text"
          initials={`+${overflow}`}
          shape={shape}
          size={size}
          style={{ zIndex: 0 }}
          className={cn(RING_WIDTH_CLASSES[size], ringClassName, OVERLAP_CLASSES[size])}
        />
      )}
    </div>
  );
}
