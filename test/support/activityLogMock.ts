import { vi } from "vitest";

/**
 * Shared `@/lib/activityLog` + `next/server` `after()` mock for route tests.
 *
 * Real `after()` throws synchronously when called outside a real Next.js
 * request scope ("`after` was called outside a request scope") — which is
 * exactly the situation a route handler is invoked in here. Every
 * money-module mutation wraps its whole body in try/catch ending in
 * `handleApiError(err)`, so an unmocked `after()` wouldn't blow up the test —
 * it would silently turn a 200/201 into a generic 500, which is worse. This
 * replaces `after` with a stand-in that invokes its callback eagerly instead
 * of deferring it, and re-exports everything else from the real `next/server`
 * (NextRequest, NextResponse, ...) untouched.
 *
 * Because the eager call happens synchronously inside the route handler
 * (before it returns its response), and `logActivity` below is a plain
 * `vi.fn()`, the call is already recorded by the time a test does
 * `const res = await POST(req)` — no extra flush/tick needed.
 */
export const logActivity = vi.fn();

vi.mock("@/lib/activityLog", () => ({
  logActivity: (...args: unknown[]) => logActivity(...args),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (task: () => unknown) => Promise.resolve(task()),
  };
});
