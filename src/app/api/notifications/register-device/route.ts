import { supabaseAdmin } from "@/lib/supabase";
import { requireUserAuth } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";

const VALID_PLATFORMS = ["android", "ios"] as const;

// ─── POST — Register (or reassign) a push token for the caller ───
export async function POST(req: Request) {
  try {
    const authUser = await requireUserAuth();

    const body = await req.json();
    const { token, platform } = body;

    if (!token || typeof token !== "string") {
      return apiError("Missing or invalid token", 400);
    }

    if (!(VALID_PLATFORMS as readonly string[]).includes(platform)) {
      return apiError(`Invalid platform. Allowed values: ${VALID_PLATFORMS.join(", ")}`, 400);
    }

    // A device token belongs to whoever is currently logged in on it, not
    // whoever registered it last time — reassign it away from any other
    // user before upserting for the caller. This matters because a forced
    // logout (session revoked elsewhere) can't call an authenticated
    // "unregister" endpoint, so without this the previous user could keep
    // receiving pushes on a device someone else is now logged into.
    const { error: reassignError } = await supabaseAdmin
      .from("device_push_tokens")
      .delete()
      .eq("token", token)
      .neq("user_id", authUser.id);

    if (reassignError) {
      return serverError(reassignError);
    }

    const { error: upsertError } = await supabaseAdmin
      .from("device_push_tokens")
      .upsert(
        {
          user_id: authUser.id,
          token,
          platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" },
      );

    if (upsertError) {
      return serverError(upsertError);
    }

    return apiSuccess(null, "Device registered");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── DELETE — Unregister a push token (best-effort, on explicit sign-out) ───
export async function DELETE(req: Request) {
  try {
    const authUser = await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return apiError("Missing token", 400);
    }

    const { error } = await supabaseAdmin
      .from("device_push_tokens")
      .delete()
      .eq("token", token)
      .eq("user_id", authUser.id);

    if (error) {
      return serverError(error);
    }

    return apiSuccess(null, "Device unregistered");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
