import { describe, it, expect, beforeEach } from "vitest";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireUserAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/notifications/mark-all-read/route");
}

beforeEach(() => {
  requireUserAuth.mockReset();
});

describe("PUT /api/notifications/mark-all-read", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT();

    expect(res.status).toBe(403);
  });

  it("marks every unread notification read for the caller", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      notifications: [{ error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT();

    expect(res.status).toBe(200);
  });

  it("surfaces a 500 on an update error", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      notifications: [{ error: { message: "timeout" } }],
    });
    const { PUT } = await importRoute();

    const res = await PUT();

    expect(res.status).toBe(500);
  });
});
