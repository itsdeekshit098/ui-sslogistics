import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireUserAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/notifications/stream/route");
}

beforeEach(() => {
  requireUserAuth.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/notifications/stream", () => {
  it("rejects when requireUserAuth fails, before opening the stream", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it("returns SSE headers once authenticated", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      notifications: [{ data: null, error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });
});
