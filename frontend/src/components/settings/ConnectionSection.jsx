import { useState } from "react";
import { getApiBaseOverride, setApiBaseOverride, resolveApiBase } from "../../services/apiBase";

// Advanced/rarely-used: overrides where the frontend sends requests, ahead of
// the Tauri-injected config and the "/api" dev-proxy fallback. Takes effect on
// reload — a live fetch mid-flight to the old host is worse than a beat of
// friction here.
export default function ConnectionSection() {
  const [value, setValue] = useState(() => getApiBaseOverride());
  const effective = resolveApiBase();

  const save = () => {
    setApiBaseOverride(value);
    window.location.reload();
  };

  const clear = () => {
    setApiBaseOverride("");
    window.location.reload();
  };

  return (
    <div className="mb-6">
      <div className="mb-2.5 text-[11px] font-bold tracking-wide text-muted-foreground">
        CONNECTION
      </div>
      <div className="mb-1.5 text-[11px] text-muted-foreground">
        Currently: <span className="font-mono">{effective}</span>
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="http://127.0.0.1:8000"
          autoComplete="off"
          className="font-sidebar h-7 min-w-0 flex-1 rounded-button border border-input-border bg-background px-2 text-xs text-input-foreground outline-none placeholder:text-input-placeholder"
        />
        <button
          type="button"
          onClick={save}
          disabled={!value.trim()}
          className="font-sidebar h-7 shrink-0 cursor-pointer rounded-button border border-input-border px-2 text-xs font-bold text-input-foreground outline-none hover:bg-button-clean-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
      {getApiBaseOverride() && (
        <button
          type="button"
          onClick={clear}
          className="font-sidebar mt-1.5 cursor-pointer text-[11px] text-muted-foreground underline outline-none hover:text-foreground"
        >
          Clear override
        </button>
      )}
    </div>
  );
}
