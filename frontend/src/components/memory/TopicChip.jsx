import { cn } from "@/lib/utils";
import Badge from "../badge/Badge";

export default function TopicChip({ name, count, projectCount, totalCount, onClick, active }) {
  const label = projectCount != null && totalCount != null
    ? `${projectCount}/${totalCount}`
    : count;

  return (
    <Badge
      color="teal"
      onClick={() => onClick(name)}
      className={cn("rounded-full", !active && "bg-avatar text-avatar-foreground hover:bg-button-clean-hover")}
    >
      {name}
      {label != null && (
        <span
          className="rounded-full bg-muted px-1.5 font-mono text-[10px] tabular-nums"
          title={projectCount != null ? "episodes in this project / total across all projects" : undefined}
        >
          {label}
        </span>
      )}
    </Badge>
  );
}
