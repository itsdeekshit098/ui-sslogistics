import { supabaseAdmin } from "@/lib/supabase";
import { requireUserAuth } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";

// ─── PUT — Mark a single notification read (scoped to the caller) ───
export async function PUT(req: Request) {
  try {
    const authUser = await requireUserAuth();

    const body = await req.json();
    const { id } = body;

    if (id === null || id === undefined) {
      return apiError("Missing id", 400);
    }

    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", authUser.id);

    if (error) {
      return serverError(error);
    }

    return apiSuccess(null, "Notification marked read");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
