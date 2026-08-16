import { vi } from "vitest";

/**
 * Shared `@/lib/auth` mock for route tests. Import the function(s) you need
 * and set behaviour per test, e.g.:
 *
 *   requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
 *   // or, to exercise the 403/401 branch:
 *   requireStrictAdminAuth.mockRejectedValue(new Error("FORBIDDEN: ..."));
 *
 * Every money-module route funnels its catch block through handleApiError,
 * which maps an "UNAUTHORIZED..." message to 401/SESSION_INVALID and a
 * "FORBIDDEN..." message to 403 — mirror those prefixes when rejecting.
 */
export const requireUserAuth = vi.fn();
export const requireAdminAuth = vi.fn();
export const requireStrictAdminAuth = vi.fn();
export const requireSuperAdminAuth = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must match the real isAdmin(role) for callers that pass it through
export const isAdmin = vi.fn((role: string | null | undefined) => true);

vi.mock("@/lib/auth", () => ({
  requireUserAuth: (...args: unknown[]) => requireUserAuth(...args),
  requireAdminAuth: (...args: unknown[]) => requireAdminAuth(...args),
  requireStrictAdminAuth: (...args: unknown[]) => requireStrictAdminAuth(...args),
  requireSuperAdminAuth: (...args: unknown[]) => requireSuperAdminAuth(...args),
  isAdmin: (role: string | null | undefined) => isAdmin(role),
}));
