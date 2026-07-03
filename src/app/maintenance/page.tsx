import { MaintenanceScreen } from "@/components/maintenanceScreen";
import { getMaintenanceStatusUncached } from "@/lib/systemSettings";

export default async function MaintenancePage() {
  const { message } = await getMaintenanceStatusUncached();
  return <MaintenanceScreen message={message} />;
}
