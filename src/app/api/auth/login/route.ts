import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/login
 *
 * Accepts { email, password } and authenticates the user
 * via the server-side Supabase client. This keeps the Supabase
 * URL and anon key off the browser entirely.
 *
 * After a successful login, all **other** sessions for this user
 * are revoked so only one active session exists at a time
 * (single-session enforcement).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return apiError("Email is required", 400);
    }

    if (!password || typeof password !== "string") {
      return apiError("Password is required", 400);
    }

    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      return apiError("Invalid email or password", 401);
    }

    // ── Single-session enforcement ──
    // Revoke all OTHER sessions so only the current login survives.
    // This uses the service-role admin client (server-side only).
    const userId = data.user?.id;
    if (userId) {
      try {
        await supabaseAdmin.auth.admin.signOut(userId, "others");
      } catch {
        logger.error("Failed to revoke other sessions during login", { userId });
      }
    }

    return apiSuccess(null, "Login successful");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
