import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { fetchRouterConfig, fetchRoles, fetchUsage } from "../services/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import RoutingModeSection from "./settings/RoutingModeSection";
import RoleAssignmentSection from "./settings/RoleAssignmentSection";
import ProviderConfigSection from "./settings/ProviderConfigSection";
import UsageSection from "./settings/UsageSection";
import ConnectionSection from "./settings/ConnectionSection";

export default function RouterSettings({
  open,
  onOpenChange,
  routingMode,
  onModeChange,
  onConfigChanged,
}) {
  const [config, setConfig] = useState(null);
  const [roles, setRoles] = useState(null);
  const [usage, setUsage] = useState(null);

  const refresh = () => {
    fetchRouterConfig().then(setConfig).catch(() => {});
    fetchRoles().then((data) => setRoles(data?.roles ?? null)).catch(() => {});
    fetchUsage(7).then(setUsage).catch(() => {});
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  // Key/role changes affect the whole app (manual picker, first-run gate) —
  // refresh both this sheet's data and App's copy of the config.
  const handleChanged = () => {
    refresh();
    onConfigChanged?.();
  };

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
          <UsageSection usage={usage} />
          <RoleAssignmentSection config={config} roles={roles} onRolesChanged={handleChanged} />
          <ProviderConfigSection config={config} onConfigChanged={handleChanged} />
          <ConnectionSection />
        </div>
      </SheetContent>
    </Sheet>
  );
}
