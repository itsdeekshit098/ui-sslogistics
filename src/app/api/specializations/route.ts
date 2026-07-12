import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";

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
    await requireAdminAuth();
    const body = await req.json();

    if (!body.name || body.name.trim() === "") {
      return apiError("Specialization name is required", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("specialization_options")
      .upsert([{ name: body.name.trim() }], { onConflict: "name" })
      .select("*")
      .single();

    if (error) {
      return serverError(error);
    }

    return apiSuccess({ specialization: data }, "Specialization added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
