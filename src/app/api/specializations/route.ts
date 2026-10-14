import { after } from "next/server";
import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";

export async function GET() {
  try {
    await requireUserAuth();

    const { data, error } = await supabaseAdmin
      .from("specialization_options")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return serverError(error);
    }

    return apiSuccess(data);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();

    if (!body.name || body.name.trim() === "") {
      return apiError("Specialization name is required", 400);
    }

    const name = body.name.trim();

    const { data, error } = await supabaseAdmin
      .from("specialization_options")
      .upsert([{ name }], { onConflict: "name" })
      .select("*")
      .single();

    if (error) {
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_SPECIALIZATION",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "specialization_options",
        recordId: data.id,
        details: { name },
      });
    });

    return apiSuccess({ specialization: data }, "Specialization added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
