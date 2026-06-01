import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/auth";

/**
 * GET — Fetch activity logs with pagination.
 * Query params: ?page=1&limit=30
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminAuth();
    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const limit = Number(req.nextUrl.searchParams.get("limit") || "30");
    const offset = (page - 1) * limit;

    // Fetch total count
    const { count, error: countErr } = await supabaseAdmin
      .from("activity_log")
      .select("id", { count: "exact", head: true });

    if (countErr) {
      logger.error("Database error", { error: countErr.message, code: countErr?.code, hint: countErr?.hint });
      return apiError("Internal server error", 500);
    }

    // Fetch paginated data
    const { data, error } = await supabaseAdmin
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    return apiSuccess({
      data,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
