import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUserAuth } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";

// ─── GET — List the caller's notifications (paginated) + unread count ───
export async function GET(req: Request) {
  try {
    const authUser = await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize")) || 20),
    );

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabaseAdmin
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    const { count: unreadCount, error: unreadError } = await supabaseAdmin
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", authUser.id)
      .is("read_at", null);

    if (unreadError) {
      logger.error("Database error", { error: unreadError.message, code: unreadError?.code });
      return apiError("Internal server error", 500);
    }

    return apiSuccess({ data: data ?? [], total: count ?? 0, unreadCount: unreadCount ?? 0 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
