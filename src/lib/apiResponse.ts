import { NextResponse } from "next/server";

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

  // Never expose internal error details to the client
  return apiError("Internal Server Error", 500);
}
