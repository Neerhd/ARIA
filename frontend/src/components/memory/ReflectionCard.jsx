import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/time";

export default function ReflectionCard({ reflection }) {
  return (
    <Card>
      <CardContent>
        <div className="mb-2 flex items-start justify-between">
          <Badge variant="tier2" className="font-semibold">{reflection.concept}</Badge>
          <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
            <span title="Source episodes">{reflection.episode_count} ep</span>
            <span>{timeAgo(reflection.created_at)}</span>
          </div>
        </div>
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          {reflection.text}
        </p>
      </CardContent>
    </Card>
  );
}
