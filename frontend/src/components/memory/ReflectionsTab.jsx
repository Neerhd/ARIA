import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ReflectionCard from "./ReflectionCard";

export default function ReflectionsTab({ reflections, running, runResult, onRunConsolidation }) {
  return (
    <>
      <div className="mb-3.5">
        <Button
          className="w-full"
          variant={running ? "outline" : "secondary"}
          onClick={onRunConsolidation}
          disabled={running}
        >
          {running ? "Running consolidation…" : "▶ Run Consolidation Now"}
        </Button>

        {runResult && (
          <Alert variant={runResult.ok ? "default" : "destructive"} className="mt-2">
            <AlertDescription>{runResult.message}</AlertDescription>
          </Alert>
        )}
      </div>

      <p className="mb-3 text-[11px] text-muted-foreground">
        Reflections are synthesised automatically each night from concepts with 3+ episodes.
      </p>

      {reflections.length === 0 ? (
        <div className="mt-8 text-center text-[13px] text-muted-foreground">
          No reflections yet. Chat more, then run consolidation.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {reflections.map((r) => <ReflectionCard key={r.id} reflection={r} />)}
        </div>
      )}
    </>
  );
}
