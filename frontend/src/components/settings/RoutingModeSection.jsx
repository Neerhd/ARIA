import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const MODES = [
  { key: "auto",   label: "Auto",   desc: "System picks the model based on what you're doing. You see which model responded." },
  { key: "ask",    label: "Ask",    desc: "System suggests an upgrade when it detects a heavier task, but asks your permission first." },
  { key: "manual", label: "Manual", desc: "You choose the tier for every conversation. Full control." },
];

export default function RoutingModeSection({ routingMode, onModeChange }) {
  return (
    <div className="mb-6">
      <div className="mb-2.5 text-[11px] font-bold tracking-wide text-muted-foreground">
        ROUTING MODE
      </div>
      <RadioGroup value={routingMode} onValueChange={onModeChange}>
        {MODES.map(({ key, label, desc }) => (
          <label
            key={key}
            htmlFor={`mode-${key}`}
            className="flex cursor-pointer flex-col gap-1 rounded-lg border border-border p-3 text-left has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/10"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value={key} id={`mode-${key}`} />
              <Label htmlFor={`mode-${key}`} className="text-sm font-semibold">
                {label}
              </Label>
            </div>
            <div className="text-[11px] leading-tight text-muted-foreground">{desc}</div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
