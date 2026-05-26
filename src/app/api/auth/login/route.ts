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

    // ── Step 1: Authenticate and create new session ──
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      return apiError("Invalid email or password", 401);
    }

    const userId = data.user?.id;
    if (!userId) {
      return apiError("Authentication failed", 500);
    }

    // ── Step 2: Single-session enforcement ──
    // Revoke all OLD sessions by deleting from auth.sessions table
    // Keep only the most recent session (the one we just created)
    try {
      const { error: revokeError } = await supabaseAdmin.rpc(
        "revoke_old_user_sessions",
        { target_user_id: userId },
      );

      if (revokeError) {
        logger.error("Failed to revoke old sessions", {
          userId,
          error: revokeError.message,
        });
      } else {
        logger.info("Revoked old sessions for user", { userId });
      }
    } catch (err) {
      logger.error("Exception while revoking old sessions", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return apiSuccess(null, "Login successful");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
