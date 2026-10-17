import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/driver-salaries/route");
}

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/driver-salaries", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/driver-salaries"));

    expect(res.status).toBe(403);
  });

  it("400s on an invalid month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-salaries?month=2026-13"),
    );

    expect(res.status).toBe(400);
  });

  it("400s when the month hasn't started yet", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-salaries?month=2026-08"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/hasn't started/);
  });

  it("defaults to the current month when none is given, and returns the sheet", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_salary_rates: [{ data: [], error: null }],
      driver_salary_entries: [{ data: [], error: null }],
      driver_salary_settlements: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/driver-salaries"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.month).toBe("2026-06");
  });

  it("computes a driver's row from attendance + rate + entries", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [{ id: 1, name: "Ravi", place: "Chennai", is_active: true }], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_salary_rates: [
        { data: [{ driver_id: 1, monthly_salary: 30000, effective_from: "2026-01-01" }], error: null },
      ],
      driver_salary_entries: [{ data: [], error: null }],
      driver_salary_settlements: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-salaries?month=2026-06"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.drivers[0]).toMatchObject({
      driver_id: 1,
      monthly_salary: 30000,
      net_pay: 30000,
    });
  });

  it("includes an inactive driver with an advance against the month even with no attendance row", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        { data: [], error: null }, // loadMonth's active-driver list — this driver is inactive & unmarked
        { data: [{ id: 2, name: "Old Driver", place: null, is_active: false }], error: null }, // missing-drivers lookup
      ],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_salary_rates: [{ data: [], error: null }],
      driver_salary_entries: [
        {
          data: [{ id: 1, driver_id: 2, entry_type: "ADVANCE", amount: 500, reverses_entry_id: null }],
          error: null,
        },
      ],
      driver_salary_settlements: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-salaries?month=2026-06"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const row = body.data.drivers.find((d: { driver_id: number }) => d.driver_id === 2);
    expect(row).toBeDefined();
    expect(row.advances).toBe(500);
  });

  it("flags the month as provisional when it hasn't finished yet", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_salary_rates: [{ data: [], error: null }],
      driver_salary_entries: [{ data: [], error: null }],
      driver_salary_settlements: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-salaries?month=2026-06"),
    );
    const body = await res.json();

    expect(body.data.is_provisional).toBe(true);
  });

  it("loads the sheet as fully unsettled when driver_salary_settlements doesn't exist yet in this database", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [{ id: 1, name: "Ravi", place: null, is_active: true }], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_salary_rates: [
        { data: [{ driver_id: 1, monthly_salary: 30000, effective_from: "2026-01-01" }], error: null },
      ],
      driver_salary_entries: [{ data: [], error: null }],
      // sql/50 not applied yet: PostgREST's "unknown table" code.
      driver_salary_settlements: [{ data: null, error: { code: "PGRST205" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-salaries?month=2026-06"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.drivers[0].is_settled).toBe(false);
  });
});
