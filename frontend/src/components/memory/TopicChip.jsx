import { Badge } from "@/components/ui/badge";

export default function TopicChip({ name, count, onClick, active }) {
  return (
    <Badge
      variant={active ? "tier2" : "outline"}
      render={<button type="button" />}
      onClick={() => onClick(name)}
      className="cursor-pointer rounded-full"
    >
      {name}
      {count != null && (
        <span className="rounded-full bg-muted px-1.5 text-[10px]">{count}</span>
      )}
    </Badge>
  );
}
