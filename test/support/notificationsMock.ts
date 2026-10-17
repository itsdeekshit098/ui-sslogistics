import { vi } from "vitest";

/**
 * Shared `@/lib/notifications` mock for route tests. `notifyRoles` fires
 * inside an `after()` callback (eagerly invoked per activityLogMock.ts), so
 * without this it would hit the real Supabase/push-notification code during
 * every test of a route that notifies on create/update/delete.
 */
export const notifyRoles = vi.fn();

vi.mock("@/lib/notifications", () => ({
  notifyRoles: (...args: unknown[]) => notifyRoles(...args),
}));
