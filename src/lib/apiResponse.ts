import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

/**
 * Standardized API response helpers.
 *
 * Success → { success: true, data, message }
 * Error   → { success: false, error }
 */

export function apiSuccess<T>(
  data: T,
  message = "Success",
  status = 200,
): NextResponse {
  return NextResponse.json({ success: true, data, message }, { status });
}

export function apiError(error: string, status = 500, code?: string): NextResponse {
  return NextResponse.json({ success: false, error, ...(code ? { code } : {}) }, { status });
}

/**
 * Normalizes an unknown error (Supabase errors are plain
 * `{ message, code, hint }` objects, not Error instances) into the
 * non-PII log/Sentry shape used across the app.
 */
function serializeErr(err: unknown): Record<string, unknown> {
  const e = err as { message?: unknown; code?: unknown; hint?: unknown } | null;
  return {
    error: e?.message ?? String(err),
    code: e?.code,
    hint: e?.hint,
  };
}

/**
 * Handled internal failure → logs, reports to Sentry, and returns a generic 500.
 *
 * Use at DB-error / internal-error branches that previously did
 * `logger.error(...) + return apiError(..., 500)`. Those branches *return*
 * instead of throwing, so they never reach handleApiError — meaning the
 * handled 5xx was invisible to Sentry. This makes them as visible as thrown
 * errors (which handleApiError already captures), while 4xx cases stay out.
 *
 * Never pass expected/client-controlled 4xx cases here — only genuine 500s.
 * handleApiError remains the capture point for *thrown* errors; this is the
 * capture point for *returned* 500s. The two are mutually exclusive code
 * paths, so no event is captured twice.
 */
export function serverError(
  err: unknown,
  context?: Record<string, unknown>,
  clientMessage = "Internal server error",
): NextResponse {
  const detail = { ...context, ...serializeErr(err) };
  logger.error("Database error", detail);
  Sentry.captureException(err instanceof Error ? err : new Error(clientMessage), {
    extra: detail,
  });
  return apiError(clientMessage, 500);
}

/**
 * Catch-all handler for route-level try/catch blocks.
 * Maps auth errors to 401/403 and everything else to a generic 500
 * so internal details are never leaked to the client.
 *
 * 401s are tagged with code "SESSION_INVALID" so clients (particularly
 * the mobile app, which has no other way to distinguish this) can tell
 * "your session no longer exists" (e.g. revoked by a login elsewhere)
 * apart from other failure modes and react accordingly (force logout +
 * redirect to login) instead of treating it like a generic/retryable error.
 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof Error) {
    if (err.message.startsWith("UNAUTHORIZED")) {
      return apiError("Unauthorized", 401, "SESSION_INVALID");
    }
    if (err.message.startsWith("FORBIDDEN")) {
      return apiError("Forbidden", 403);
    }
    if (err.message.startsWith("MAINTENANCE")) {
      return apiError("Under maintenance", 503, "MAINTENANCE_MODE");
    }
  }

  // Every route handler funnels its catch block through handleApiError,
  // so this one call covers all ~27 API routes instead of adding
  // Sentry.captureException at every call site. Only unexpected errors
  // reach here — expected auth/maintenance cases returned above, so
  // Sentry only sees real bugs, not routine 401s.
  Sentry.captureException(err);

  // Never expose internal error details to the client
  return apiError("Internal Server Error", 500);
}
