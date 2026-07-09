import { Paperclip, MessageSquare, Search, Save, FolderOpen, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SIGNAL_ICONS = {
  "file attached": Paperclip,
  "long conversation (15+ messages)": MessageSquare,
  "web search enabled (→ T3)": Search,
  "file writer enabled (→ T3)": Save,
  "file reader enabled (→ T3)": FolderOpen,
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
              {signals.map((s) => {
                const Icon = SIGNAL_ICONS[s];
                return (
                  <Badge key={s} variant="secondary">
                    {Icon && <Icon />} {s}
                  </Badge>
                );
              })}
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
