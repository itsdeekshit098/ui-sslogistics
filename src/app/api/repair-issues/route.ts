import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUserAuth, requireAdminAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireUserAuth();

    const { data, error } = await supabaseAdmin
      .from("repair_issue_options")
      .select("category, name")
      .order("name", { ascending: true });

    if (error) {
      return apiError(error.message, 500);
    }

    // Group by category
    const grouped: Record<string, string[]> = {
      electrical: [],
      mechanical: [],
    };

    data?.forEach((row) => {
      if (grouped[row.category]) {
        grouped[row.category].push(row.name);
      }
    });

    return apiSuccess(grouped);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    // Only staff and admin can add options
    await requireAdminAuth();
    const body = await req.json();

    if (!body.name || body.name.trim() === "") {
      return apiError("Issue name is required", 400);
    }

    if (!body.category || !["electrical", "mechanical"].includes(body.category)) {
      return apiError("Invalid category", 400);
    }

    const name = body.name.trim();

    // Use a clean upsert or simple insert with onConflict ignore based on the unique index.
    // Since we want to return the actual saved name, we can do an insert and handle unique constraint violations.
    const { data, error } = await supabaseAdmin
      .from("repair_issue_options")
      .insert([{ category: body.category, name }])
      .select("*")
      .single();

    if (error) {
      // If the error is a unique constraint violation (code 23505), it means a similar issue exists.
      if (error.code === "23505") {
        return apiError("A similar issue already exists in this category.", 409);
      }
      return apiError(error.message, 500);
    }

    return apiSuccess({ issue: data }, "Issue option added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
