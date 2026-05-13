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

export function apiError(error: string, status = 500): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Catch-all handler for route-level try/catch blocks.
 * Maps auth errors to 401/403 and everything else to a generic 500
 * so internal details are never leaked to the client.
 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof Error) {
    if (err.message.startsWith("UNAUTHORIZED")) {
      return apiError(err.message, 401);
    }
    if (err.message.startsWith("FORBIDDEN")) {
      return apiError(err.message, 403);
    }
  }

  // Never expose internal error details to the client
  return apiError("Internal Server Error", 500);
}
