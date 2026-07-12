import { requireSuperAdminAuth } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";
import { getMaintenanceStatusUncached, setMaintenanceMode } from "@/lib/systemSettings";
import { logActivity } from "@/lib/activityLog";

export async function GET() {
  try {
    await requireSuperAdminAuth();
    const status = await getMaintenanceStatusUncached();
    return apiSuccess(status);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const authUser = await requireSuperAdminAuth();

    const body = await req.json();
    const { maintenanceMode, message } = body;

    if (typeof maintenanceMode !== "boolean") {
      return apiError("maintenanceMode must be a boolean", 400);
    }
    if (message !== undefined && message !== null && typeof message !== "string") {
      return apiError("message must be a string or null", 400);
    }

    await setMaintenanceMode(maintenanceMode, message || null, authUser.id);

    await logActivity({
      action: maintenanceMode ? "ENABLE_MAINTENANCE_MODE" : "DISABLE_MAINTENANCE_MODE",
      userId: authUser.id,
      userEmail: authUser.email,
      userDisplayName: authUser.displayName,
      tableName: "system_settings",
      recordId: null,
      details: { message: message || null },
    });

    return apiSuccess(
      { maintenanceMode, message: message || null },
      maintenanceMode ? "Maintenance mode enabled" : "Maintenance mode disabled",
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
