import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/time";

export default function PinnedFactCard({ fact, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    try {
      await onDelete(fact.id);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex items-start gap-2.5">
        <span className="mt-px shrink-0 text-base">📌</span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[13px] leading-relaxed break-words text-foreground">
            {fact.text}
          </p>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {timeAgo(fact.created_at)}
          </span>
        </div>
        <Button
          size="sm"
          variant={confirming ? "destructive" : "outline"}
          onClick={handleDelete}
          disabled={deleting}
          title={confirming ? "Click again to confirm" : "Remove pinned fact"}
          className="shrink-0"
        >
          {deleting ? "…" : confirming ? "Confirm" : "×"}
        </Button>
      </CardContent>
    </Card>
  );
}
