import { Badge } from "@/components/ui/badge";

export default function TopicChip({ name, count, projectCount, totalCount, onClick, active }) {
  const label = projectCount != null && totalCount != null
    ? `${projectCount}/${totalCount}`
    : count;

  return (
    <Badge
      variant={active ? "tier2" : "outline"}
      render={<button type="button" />}
      onClick={() => onClick(name)}
      className="cursor-pointer rounded-full"
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
