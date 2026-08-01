import { cn } from "@/lib/utils";

// Infra fields only, in scripts/start.sh's own startup order — matches what
// useHealthGate gates on. Providers are deliberately absent: a missing key
// is a first-run state handled by FirstRunSetup, not a boot step.
const SERVICES = [
  { key: "neo4j", label: "Knowledge graph" },
  { key: "sqlite", label: "Database" },
  { key: "chroma", label: "Memory store" },
];

// A full-window overlay over the already-mounted app (not a separate splash
// window — see NEE-16 Phase 0) shown until useHealthGate reports ready.
export default function LaunchOverlay({ health }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-xs">
        <p className="font-sidebar mb-4 text-center text-sm font-bold text-foreground">
          Starting ARIA…
        </p>
        <ul className="space-y-2">
          {SERVICES.map(({ key, label }) => (
            <li key={key} className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{label}</span>
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  health[key] ? "bg-emerald-500" : "animate-pulse bg-muted-foreground/30"
                )}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
