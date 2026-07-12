import { apiSuccess, handleApiError } from "@/lib/apiResponse";
import { getAppVersionConfigUncached } from "@/lib/systemSettings";

// Public route — no auth required. Must be reachable pre-login (a user
// stuck on an old build may not be able to authenticate at all if the auth
// flow itself changed) and during maintenance mode. See middleware.ts.
export async function GET() {
  try {
    const config = await getAppVersionConfigUncached();
    return apiSuccess(config);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
