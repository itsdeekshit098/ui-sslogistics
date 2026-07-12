import { requireSuperAdminAuth } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";
import { getAppVersionConfigUncached, setMinAndroidVersionCode } from "@/lib/systemSettings";
import { logActivity } from "@/lib/activityLog";

export async function GET() {
  try {
    await requireSuperAdminAuth();
    const config = await getAppVersionConfigUncached();
    return apiSuccess(config);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const authUser = await requireSuperAdminAuth();

    const body = await req.json();
    const { minAndroidVersionCode, message } = body;

    if (
      minAndroidVersionCode !== null &&
      (typeof minAndroidVersionCode !== "number" || !Number.isInteger(minAndroidVersionCode))
    ) {
      return apiError("minAndroidVersionCode must be an integer or null", 400);
    }
    if (message !== undefined && message !== null && typeof message !== "string") {
      return apiError("message must be a string or null", 400);
    }

    await setMinAndroidVersionCode(minAndroidVersionCode, message || null, authUser.id);

    await logActivity({
      action: "SET_MIN_APP_VERSION",
      userId: authUser.id,
      userEmail: authUser.email,
      userDisplayName: authUser.displayName,
      tableName: "system_settings",
      recordId: null,
      details: { minAndroidVersionCode, message: message || null },
    });

    return apiSuccess(
      { minAndroidVersionCode, forceUpdateMessage: message || null },
      minAndroidVersionCode
        ? "Minimum app version updated"
        : "Force-update requirement cleared",
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
