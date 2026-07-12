import { MaintenanceSettings } from "@/components/maintenanceSettings";
import { AppVersionSettings } from "@/components/appVersionSettings";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <MaintenanceSettings />
      <AppVersionSettings />
    </div>
  );
}
