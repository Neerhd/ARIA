import { useState } from "react";
import Badge from "../badge/Badge";
import { setProviderKey, removeProviderKey } from "../../services/api";

function ProviderRow({ id, info, onConfigChanged }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [replacing, setReplacing] = useState(false);

  const showInput = !info.configured || replacing;

  const connect = async () => {
    if (!key.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setProviderKey(id, key.trim());
      setKey("");
      setReplacing(false);
      onConfigChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeProviderKey(id);
      onConfigChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-lg border p-3 ${info.configured ? "border-primary/40" : "border-border"}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className={`text-xs font-bold ${info.configured ? "text-foreground" : "text-muted-foreground"}`}>
          {info.label}
          {info.default && (
            <span className="ml-1.5 font-normal text-muted-foreground">· default</span>
          )}
        </span>
        <Badge color={info.configured ? "green" : "amber"}>
          {info.configured ? "connected" : "no key"}
        </Badge>
      </div>
      <div className="mb-1.5 text-[11px] text-muted-foreground">{info.model}</div>

      {showInput ? (
        <div className="flex gap-1.5">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connect()}
            placeholder="Paste API key"
            disabled={busy}
            autoComplete="off"
            className="font-sidebar h-7 min-w-0 flex-1 rounded-button border border-input-border bg-background px-2 text-xs text-input-foreground outline-none placeholder:text-input-placeholder disabled:opacity-50"
          />
          <button
            type="button"
            onClick={connect}
            disabled={busy || !key.trim()}
            className="font-sidebar h-7 shrink-0 cursor-pointer rounded-button border border-input-border px-2 text-xs font-bold text-input-foreground outline-none hover:bg-button-clean-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Checking…" : "Connect"}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setReplacing(true)}
            className="font-sidebar cursor-pointer text-[11px] text-muted-foreground underline outline-none hover:text-foreground"
          >
            Replace key
          </button>
          {info.key_source === "stored" && (
            <button
              type="button"
              onClick={disconnect}
              disabled={busy}
              className="font-sidebar cursor-pointer text-[11px] text-muted-foreground underline outline-none hover:text-foreground disabled:opacity-50"
            >
              Disconnect
            </button>
          )}
        </div>
      )}

      {!info.configured && (
        <a
          href={info.key_url}
          target="_blank"
          rel="noreferrer"
          className="font-sidebar mt-1.5 inline-block text-[11px] text-muted-foreground underline hover:text-foreground"
        >
          Get a key ↗
        </a>
      )}
      {error && (
        <div className="mt-1.5 text-[11px] leading-tight text-destructive">{error}</div>
      )}
    </div>
  );
}

export default function ProviderConfigSection({ config, onConfigChanged }) {
  return (
    <div>
      <div className="mb-2.5 text-[11px] font-bold tracking-wide text-muted-foreground">
        AI PROVIDERS
      </div>
      {config ? (
        <div className="flex flex-col gap-2">
          {Object.entries(config.providers).map(([id, info]) => (
            <ProviderRow key={id} id={id} info={info} onConfigChanged={onConfigChanged} />
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Loading providers…</div>
      )}
    </div>
  );
}
