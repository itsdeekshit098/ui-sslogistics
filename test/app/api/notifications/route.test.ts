import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireUserAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/notifications/route");
}

beforeEach(() => {
  requireUserAuth.mockReset();
});

describe("GET /api/notifications", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/notifications"));

    expect(res.status).toBe(403);
  });

  it("returns the caller's notifications with total and unread count", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      notifications: [
        { data: [{ id: 1, user_id: ADMIN_USER.id }], error: null, count: 1 },
        { count: 1, error: null },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/notifications"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.total).toBe(1);
    expect(body.data.unreadCount).toBe(1);
  });

  it("surfaces a 500 when the list query errors", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      notifications: [{ data: null, error: { message: "timeout" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/notifications"));

    expect(res.status).toBe(500);
  });

  it("surfaces a 500 when the unread-count query errors", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      notifications: [
        { data: [], error: null, count: 0 },
        { count: null, error: { message: "timeout" } },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/notifications"));

    expect(res.status).toBe(500);
  });
});
