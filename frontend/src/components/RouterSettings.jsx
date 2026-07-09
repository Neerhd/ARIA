import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { fetchRouterConfig } from "../services/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import RoutingModeSection from "./settings/RoutingModeSection";
import ToolsSection from "./settings/ToolsSection";
import TierConfigSection from "./settings/TierConfigSection";

export default function RouterSettings({
  open,
  onOpenChange,
  routingMode,
  onModeChange,
  toolsEnabled,
  onToolToggle,
}) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    if (open) fetchRouterConfig().then(setConfig).catch(() => {});
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[340px] sm:max-w-[340px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="size-4" /> Settings
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <RoutingModeSection routingMode={routingMode} onModeChange={onModeChange} />
          <ToolsSection toolsEnabled={toolsEnabled} onToolToggle={onToolToggle} />
          <TierConfigSection config={config} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
