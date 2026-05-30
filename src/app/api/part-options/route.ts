import { logger } from "@/lib/logger";
import { after } from "next/server";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";

// ─── GET — List/search part options (typeahead) ───

export async function GET(req: Request) {
  try {
    await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit")) || 50),
    );

    let query = supabaseAdmin
      .from("part_options")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(limit);

    if (search) {
      const safe = search.replace(/[,.*()%_]/g, "");
      query = query.ilike("name", `%${safe}%`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    return apiSuccess({ data: data ?? [] });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST — Add new part option ───

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return apiError("Part name is required", 400);
    }

    const { data: partOption, error } = await supabaseAdmin
      .from("part_options")
      .insert([{ name, created_by: authUser.id }])
      .select("id, name")
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("This part name already exists", 409);
      }
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_PART_OPTION",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "part_options",
        recordId: partOption.id,
        details: { name: partOption.name },
      });
    });

    return apiSuccess({ partOption }, "Part option added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
