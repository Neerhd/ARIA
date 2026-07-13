import { Paperclip, MessageSquare, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Badge from "./badge/Badge";

// classify_action only ever emits these two now — tool use no longer
// pre-emptively escalates the tier, so it can't appear as a signal here.
const SIGNAL_ICONS = {
  "file attached": Paperclip,
  "long conversation (15+ messages)": MessageSquare,
};

export default function RoutingPrompt({ data, onConfirm, onDecline }) {
  const { suggested_tier, suggested_model, signals = [] } = data;
  const shortModel = (suggested_model || "").split(":")[0];

  return (
    <div className="flex justify-start">
      <Card className="max-w-[72%]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xs">
            <Zap className="size-3.5" />
            Tier {suggested_tier} recommended
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            This task would benefit from{" "}
            <strong className="text-foreground">{shortModel}</strong>{" "}
            (Tier {suggested_tier}).
          </p>

          {signals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {signals.map((s) => (
                <Badge key={s} color="orange" icon={SIGNAL_ICONS[s]}>
                  {s}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={onConfirm}>
              Use {shortModel}
            </Button>
            <Button className="flex-1" variant="outline" onClick={onDecline}>
              Keep Tier 1
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
