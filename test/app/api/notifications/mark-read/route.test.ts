import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireUserAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/notifications/mark-read/route");
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/notifications/mark-read", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireUserAuth.mockReset();
});

describe("PUT /api/notifications/mark-read", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest({ id: 1 }));

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest({}));

    expect(res.status).toBe(400);
  });

  it("marks the notification read, scoped to the caller", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      notifications: [{ error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest({ id: 1 }));

    expect(res.status).toBe(200);
  });

  it("surfaces a 500 on an update error", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      notifications: [{ error: { message: "timeout" } }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest({ id: 1 }));

    expect(res.status).toBe(500);
  });
});
