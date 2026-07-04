import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUserAuth } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";

// ─── PUT — Mark all of the caller's unread notifications read ───
export async function PUT() {
  try {
    const authUser = await requireUserAuth();

    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", authUser.id)
      .is("read_at", null);

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    return apiSuccess(null, "All notifications marked read");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
