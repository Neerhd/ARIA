import { assignRole, resetRole } from "../../services/api";

/**
 * Role → model assignments — which model answers each kind of task in Auto
 * mode. "Default" tracks the default provider dynamically; an explicit pick
 * sticks until reset (or until its provider's key is removed, at which point
 * the backend falls back to the default on its own).
 */
export default function RoleAssignmentSection({ config, roles, onRolesChanged }) {
  const options = config
    ? Object.entries(config.providers)
        .filter(([, p]) => p.configured)
        .flatMap(([pid, p]) =>
          p.models.map((m) => ({ provider: pid, model: m.id, label: m.label }))
        )
    : [];

  const labelFor = (model) => options.find((o) => o.model === model)?.label ?? model;

  const handleChange = async (roleId, value) => {
    try {
      if (value === "__default__") {
        await resetRole(roleId);
      } else {
        const [provider, model] = value.split("::");
        await assignRole(roleId, provider, model);
      }
      onRolesChanged();
    } catch {
      // sheet re-render keeps showing server truth; nothing else to do
    }
  };

  return (
    <div className="mb-6">
      <div className="mb-1 text-[11px] font-bold tracking-wide text-muted-foreground">
        TASK ROLES
      </div>
      <div className="mb-2.5 text-[11px] leading-tight text-muted-foreground/70">
        In Auto mode, each message is classified into a task and answered by
        that task's assigned model.
      </div>
      {roles ? (
        <div className="flex flex-col gap-2">
          {Object.entries(roles).map(([roleId, info]) => (
            <div key={roleId} className="rounded-lg border border-border p-3">
              <div className="mb-0.5 text-xs font-bold text-foreground">{info.label}</div>
              <div className="mb-1.5 text-[11px] leading-tight text-muted-foreground/70">
                {info.description}
              </div>
              <select
                value={info.overridden ? `${info.provider}::${info.model}` : "__default__"}
                onChange={(e) => handleChange(roleId, e.target.value)}
                className="font-sidebar h-7 w-full cursor-pointer rounded-button border border-input-border bg-background px-1.5 text-xs text-input-foreground outline-none"
              >
                <option value="__default__">Default · {labelFor(info.model)}</option>
                {options.map((o) => (
                  <option key={`${o.provider}::${o.model}`} value={`${o.provider}::${o.model}`}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Loading roles…</div>
      )}
    </div>
  );
}
