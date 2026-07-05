import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";

/**
 * GET /api/auth/session
 *
 * Returns the current authenticated user and their role.
 * Used by AuthContext on mount and on tab re-focus to keep
 * the client-side auth state in sync without needing the
 * Supabase client in the browser.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return apiError("Not authenticated", 401, "SESSION_INVALID");
    }

    return apiSuccess({
      id: user.id,
      email: user.email || null,
      role: user.app_metadata?.role || null,
      displayName: user.user_metadata?.display_name || user.email || null,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
