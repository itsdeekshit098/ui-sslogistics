import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/driver-salaries/[driverId]/trip-count/route");
}

const URL = "http://localhost/api/driver-salaries/1/trip-count";
const params = { params: Promise.resolve({ driverId: "1" }) };

function post(body: unknown) {
  return new NextRequest(URL, { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/driver-salaries/[driverId]/trip-count", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(post({ period_month: "2026-06", trip_count: 3 }), params);

    expect(res.status).toBe(403);
  });

  it("400s on a month that hasn't started — a future month would leave an orphan row", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(post({ period_month: "2026-07", trip_count: 3 }), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/hasn't started/);
  });

  it("400s on a trip count that isn't a whole number of zero or more", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    for (const trip_count of [-1, 2.5, "4", null, NaN]) {
      const res = await POST(post({ period_month: "2026-06", trip_count }), params);
      expect(res.status).toBe(400);
    }
  });

  it("400s on an absurd trip count instead of letting the database overflow into a 500", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(post({ period_month: "2026-06", trip_count: 1e15 }), params);

    expect(res.status).toBe(400);
  });

  it("400s on malformed JSON", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(new NextRequest(URL, { method: "POST", body: "{oops" }), params);

    expect(res.status).toBe(400);
  });

  it("404s when the driver does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ drivers: [{ data: null, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(post({ period_month: "2026-06", trip_count: 3 }), params);

    expect(res.status).toBe(404);
  });

  it("400s for a driver paid monthly", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_pay_types: [{ data: [], error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(post({ period_month: "2026-06", trip_count: 3 }), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/paid monthly/);
  });

  it("sets a trip count for a per-trip driver", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_pay_types: [
        { data: [{ pay_type: "PER_TRIP", rate_per_trip: "500", effective_from: "2026-01-01" }], error: null },
      ],
      driver_salary_settlements: [{ data: null, error: null }],
      driver_trip_counts: [
        { data: null, error: null },
        { data: { id: 7, driver_id: 1, period_month: "2026-06-01", trip_count: 4 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(post({ period_month: "2026-06", trip_count: 4 }), params);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.tripCount.trip_count).toBe(4);
  });
});
