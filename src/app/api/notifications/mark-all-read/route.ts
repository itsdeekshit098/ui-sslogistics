import { supabaseAdmin } from "@/lib/supabase";
import { requireUserAuth } from "@/lib/auth";
import { apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";

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
      return serverError(error);
    }

    return apiSuccess(null, "All notifications marked read");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
