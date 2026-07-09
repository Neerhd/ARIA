import { Search, FolderOpen, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const TOOLS = [
  {
    key: "web_search",
    label: "Web Search",
    icon: Search,
    desc: "Search the web via SearXNG (self-hosted). Auto-upgrades to T3 when enabled.",
    note: "Requires SearXNG running on localhost:8080",
  },
  {
    key: "file_reader",
    label: "File Reader",
    icon: FolderOpen,
    desc: "ARIA can read any local file by path during the conversation.",
    note: "Auto-upgrades to T3 for reliable tool execution",
  },
  {
    key: "file_writer",
    label: "File Writer",
    icon: Save,
    desc: "ARIA can create and write files to any local path (e.g. save a report to your Desktop).",
    note: "Auto-upgrades to T3 for reliable tool execution",
  },
];

export default function ToolsSection({ toolsEnabled, onToolToggle }) {
  return (
    <div className="mb-6">
      <div className="mb-2.5 text-[11px] font-bold tracking-wide text-muted-foreground">
        TOOLS
      </div>
      <div className="flex flex-col gap-2">
        {TOOLS.map(({ key, label, icon: Icon, desc, note }) => {
          const active = toolsEnabled.includes(key);
          return (
            <div
              key={key}
              className={`flex items-start gap-2.5 rounded-lg border p-3 ${
                active ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <Icon className="mt-px size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <Label htmlFor={`tool-${key}`} className="mb-0.5 text-sm font-semibold">
                  {label}
                </Label>
                <div className="mb-0.5 text-[11px] leading-tight text-muted-foreground">{desc}</div>
                <div className="text-[10px] text-muted-foreground/70">{note}</div>
              </div>
              <Switch
                id={`tool-${key}`}
                checked={active}
                onCheckedChange={(checked) => onToolToggle(key, checked)}
                className="mt-0.5 shrink-0"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
