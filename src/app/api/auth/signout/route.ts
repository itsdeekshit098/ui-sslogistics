import { createClient } from "@/utils/supabase/server";
import { apiSuccess, serverError, handleApiError } from "@/lib/apiResponse";

/**
 * POST /api/auth/signout
 *
 * Signs the user out by calling supabase.auth.signOut() on the
 * server-side client, which clears the session cookies.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      return serverError(signOutError, undefined, "Failed to sign out");
    }

    return apiSuccess(null, "Signed out successfully");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
