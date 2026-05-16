import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";

/**
 * POST /api/auth/login
 *
 * Accepts { email, password } and authenticates the user
 * via the server-side Supabase client. This keeps the Supabase
 * URL and anon key off the browser entirely.
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
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      return apiError("Invalid email or password", 401);
    }

    return apiSuccess(null, "Login successful");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
