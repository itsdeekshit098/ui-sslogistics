"use client";

import { useAuth } from "@/context/AuthContext";
import { useMaintenance } from "@/context/MaintenanceContext";
import { MaintenanceScreen } from "@/components/maintenanceScreen";
import { isAdmin } from "@/lib/routePermissions";

/**
 * Blocks the whole app in place the instant maintenance mode turns on,
 * for any tab that's already open — no navigation involved, just swapping
 * out what's rendered, so it can't be missed even if the user is sitting
 * on a static screen doing nothing. Admins pass through unaffected so the
 * owner can verify things and turn it back off.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { maintenanceMode, message } = useMaintenance();
  const { userRole, loading } = useAuth();

  if (!loading && maintenanceMode && !isAdmin(userRole)) {
    return <MaintenanceScreen message={message} />;
  }

  return <>{children}</>;
}
