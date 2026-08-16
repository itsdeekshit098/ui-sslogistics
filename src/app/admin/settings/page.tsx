import { MaintenanceSettings } from "@/components/maintenanceSettings";
import { AppVersionSettings } from "@/components/appVersionSettings";
import { ListSettings } from "@/components/listSettings";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <MaintenanceSettings />
      <AppVersionSettings />
      <ListSettings />
    </div>
  );
}
