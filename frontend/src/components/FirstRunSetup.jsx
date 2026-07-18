import { useState } from "react";
import { cn } from "@/lib/utils";
import { setProviderKey } from "../services/api";

/**
 * Shown when no AI provider is configured at all — ARIA can't chat until at
 * least one API key exists. Walks a first-time user through picking a
 * provider, creating a key on that provider's site, and pasting it in. The
 * key is verified with a live request before the overlay clears.
 */
export default function FirstRunSetup({ providers, onConnected }) {
  const [selected, setSelected] = useState("anthropic");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const info = providers[selected];

  const connect = async () => {
    if (!key.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setProviderKey(selected, key.trim());
      onConnected();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-input border border-border bg-background p-6 shadow-lg">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Welcome to ARIA</h2>
        <p className="mb-4 text-sm leading-snug text-muted-foreground">
          ARIA needs at least one AI provider to chat. Pick one below, create
          an API key on their site (takes about two minutes), and paste it
          here. You can add more providers later in Settings.
        </p>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {Object.entries(providers).map(([id, p]) => (
            <button
              key={id}
              type="button"
              onClick={() => { setSelected(id); setError(null); }}
              aria-pressed={id === selected}
              className={cn(
                "font-sidebar h-7 cursor-pointer rounded-button px-2.5 text-xs font-bold outline-none transition-colors",
                id === selected
                  ? "border border-input-border text-input-foreground"
                  : "text-muted-foreground hover:bg-button-clean-hover"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <a
          href={info.key_url}
          target="_blank"
          rel="noreferrer"
          className="font-sidebar mb-3 inline-block text-xs text-muted-foreground underline hover:text-foreground"
        >
          Get a {info.label} API key ↗
        </a>

        <div className="flex gap-1.5">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connect()}
            placeholder="Paste your API key"
            disabled={busy}
            autoComplete="off"
            className="font-sidebar h-9 min-w-0 flex-1 rounded-button border border-input-border bg-background px-2.5 text-sm text-input-foreground outline-none placeholder:text-input-placeholder disabled:opacity-50"
          />
          <button
            type="button"
            onClick={connect}
            disabled={busy || !key.trim()}
            className="font-sidebar h-9 shrink-0 cursor-pointer rounded-button border border-input-border px-3 text-sm font-bold text-input-foreground outline-none hover:bg-button-clean-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Checking key…" : "Connect"}
          </button>
        </div>

        {error && (
          <div className="mt-2 text-xs leading-tight text-destructive">{error}</div>
        )}
      </div>
    </div>
  );
}
