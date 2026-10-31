import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/driver-salaries/[driverId]/settle/route");
}

function paramsFor(driverId: string) {
  return { params: Promise.resolve({ driverId }) };
}

function jsonRequest(url: string, body?: unknown) {
  return new NextRequest(url, {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const URL = "http://localhost/api/driver-salaries/1/settle";

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
  vi.useFakeTimers();
  // Mid-July: June is a finished month, so it can be settled; July is not.
  vi.setSystemTime(new Date("2026-07-15T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/driver-salaries/[driverId]/settle", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, {}), paramsFor("1"));

    expect(res.status).toBe(403);
  });

  it("400s on an invalid month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, { period_month: "garbage", amount_paid: 1000 }),
      paramsFor("1"),
    );

    expect(res.status).toBe(400);
  });

  it("400s when the month hasn't started yet", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, { period_month: "2026-08", amount_paid: 1000 }),
      paramsFor("1"),
    );

    expect(res.status).toBe(400);
  });

  it("400s on the current month — a month is settled once it is over", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, { period_month: "2026-07", amount_paid: 1000 }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/once it is over/);
  });

  it("allows the month that just ended, on the first day of the next", async () => {
    vi.setSystemTime(new Date("2026-07-01T00:30:00+05:30")); // 30 June 19:00 UTC, already 1 July in India
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, { period_month: "2026-06", amount_paid: -1 }),
      paramsFor("1"),
    );
    const body = await res.json();

    // Gets past the month check and fails on the amount instead.
    expect(res.status).toBe(400);
    expect(body.error).not.toMatch(/once it is over/);
  });

  it("400s when amount_paid is missing or negative", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, { period_month: "2026-06", amount_paid: -5 }),
      paramsFor("1"),
    );

    expect(res.status).toBe(400);
  });

  it("404s when the driver does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, { period_month: "2026-06", amount_paid: 15000 }),
      paramsFor("1"),
    );

    expect(res.status).toBe(404);
  });

  it("409s when the month is already settled", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_salary_settlements: [{ data: { id: 50 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, { period_month: "2026-06", amount_paid: 15000 }),
      paramsFor("1"),
    );

    expect(res.status).toBe(409);
  });

  it("400s when the driver has no salary rate set, instead of carrying the whole amount forward", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        { data: { id: 1 }, error: null }, // settle route's own driver check
        { data: { id: 1, name: "Ravi", place: null, is_active: true }, error: null }, // loadDriverSalary's driverRes
        { data: [{ id: 1, name: "Ravi", place: null, is_active: true }], error: null }, // loadMonth's fetchDrivers
      ],
      driver_salary_settlements: [
        { data: null, error: null }, // existing-settlement check: none
        { data: null, error: null }, // loadDriverSalary's settlement lookup: none
      ],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_pay_types: [{ data: [], error: null }],
      driver_trip_counts: [{ data: [], error: null }],
      driver_salary_rates: [{ data: [], error: null }], // no rate ever set
      driver_salary_entries: [{ data: [], error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, { period_month: "2026-06", amount_paid: 20000 }),
      paramsFor("1"),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an amount above the ceiling or finer than a paisa", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    for (const amount_paid of [1e20, 10_000_001, 100.555]) {
      const res = await POST(jsonRequest(URL, { period_month: "2026-06", amount_paid }), paramsFor("1"));
      expect(res.status).toBe(400);
    }
  });

  it("400s on a body that isn't a JSON object instead of a 500", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      new NextRequest(URL, { method: "POST", body: "{oops" }),
      paramsFor("1"),
    );

    expect(res.status).toBe(400);
  });

  describe("a per-trip driver", () => {
    function mockPerTrip(tripCount: number | null) {
      return mockSupabaseAdmin(
        {
          drivers: [
            { data: { id: 1 }, error: null },
            { data: { id: 1, name: "Ravi", place: null, is_active: true }, error: null },
            { data: [{ id: 1, name: "Ravi", place: null, is_active: true }], error: null },
          ],
          driver_salary_settlements: [
            { data: null, error: null },
            { data: null, error: null },
          ],
          driver_attendance: [{ data: [], error: null }],
          driver_shift_counts: [{ data: [], error: null }],
          driver_pay_types: [
            {
              data: [{ id: 1, driver_id: 1, pay_type: "PER_TRIP", rate_per_trip: "500", effective_from: "2026-01-01" }],
              error: null,
            },
          ],
          driver_trip_counts: [
            {
              data:
                tripCount == null
                  ? null
                  : { id: 1, driver_id: 1, period_month: "2026-06-01", trip_count: tripCount, note: null, created_at: "x" },
              error: null,
            },
          ],
          // A per-trip driver has no monthly salary at all.
          driver_salary_rates: [{ data: [], error: null }],
          driver_salary_entries: [{ data: [], error: null }],
        },
        { settle_driver_salary: [{ data: [{ settlement_id: 9, carry_forward_entry_id: null }], error: null }] },
      );
    }

    it("can be settled once the rate and trip count are known, even with no monthly salary", async () => {
      requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
      mockPerTrip(4);
      const { POST } = await importRoute();

      const res = await POST(
        jsonRequest(URL, { period_month: "2026-06", amount_paid: 2000 }),
        paramsFor("1"),
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.settlement.net_pay_computed).toBe(2000);
    });

    it("is told what is missing, in per-trip terms, when there is no trip count yet", async () => {
      requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
      mockPerTrip(null);
      const { POST } = await importRoute();

      const res = await POST(
        jsonRequest(URL, { period_month: "2026-06", amount_paid: 2000 }),
        paramsFor("1"),
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toMatch(/trip count/);
    });
  });

  // The happy path goes through settle_driver_salary (sql/50) in one
  // transaction; loadDriverSalary still runs first (to get net_pay) using
  // its own .from() chain, then the write is one .rpc() call.
  function mockLoadAndRpc(rpcRow: { settlement_id: number; carry_forward_entry_id: number | null }) {
    return mockSupabaseAdmin(
      {
        drivers: [
          { data: { id: 1 }, error: null }, // settle route's own driver check
          { data: { id: 1, name: "Ravi", place: null, is_active: true }, error: null }, // loadDriverSalary's driverRes
          { data: [{ id: 1, name: "Ravi", place: null, is_active: true }], error: null }, // loadMonth's fetchDrivers
        ],
        driver_salary_settlements: [
          { data: null, error: null }, // existing-settlement check: none
          { data: null, error: null }, // loadDriverSalary's settlement lookup: none
        ],
        driver_attendance: [{ data: [], error: null }],
        driver_shift_counts: [{ data: [], error: null }],
        driver_pay_types: [{ data: [], error: null }],
        driver_trip_counts: [{ data: [], error: null }],
        driver_salary_rates: [
          { data: [{ id: 1, driver_id: 1, monthly_salary: "15000", effective_from: "2026-01-01" }], error: null },
        ],
        driver_salary_entries: [{ data: [], error: null }],
      },
      { settle_driver_salary: [{ data: [rpcRow], error: null }] },
    );
  }

  it("settles exactly at net pay with no carry-forward entry created", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockLoadAndRpc({ settlement_id: 50, carry_forward_entry_id: null });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, { period_month: "2026-06", amount_paid: 15000 }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.settlement.carry_forward_entry_id).toBeNull();
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SETTLE_DRIVER_SALARY",
        details: expect.objectContaining({ carry_forward: 0 }),
      }),
    );
  });

  it("carries an overpayment forward as an ADVANCE on next month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockLoadAndRpc({ settlement_id: 50, carry_forward_entry_id: 77 });
    const { POST } = await importRoute();

    // Driver owed 15000, paid 20000 — 5000 overpaid, carried forward.
    const res = await POST(
      jsonRequest(URL, { period_month: "2026-06", amount_paid: 20000 }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.settlement.carry_forward_entry_id).toBe(77);
    expect(body.message).toMatch(/overpayment carried/);
  });

  it("carries a shortfall forward as a DEDUCTION on next month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockLoadAndRpc({ settlement_id: 51, carry_forward_entry_id: 78 });
    const { POST } = await importRoute();

    // Driver owed 15000, paid only 10000 — 5000 short, carried forward.
    const res = await POST(
      jsonRequest(URL, { period_month: "2026-06", amount_paid: 10000 }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.settlement.carry_forward_entry_id).toBe(78);
    expect(body.message).toMatch(/shortfall carried/);
  });

  it("409s when the RPC rejects a double-settle via the unique constraint", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {
        drivers: [
          { data: { id: 1 }, error: null },
          { data: { id: 1, name: "Ravi", place: null, is_active: true }, error: null },
          { data: [{ id: 1, name: "Ravi", place: null, is_active: true }], error: null },
        ],
        driver_salary_settlements: [{ data: null, error: null }],
        driver_attendance: [{ data: [], error: null }],
        driver_shift_counts: [{ data: [], error: null }],
        driver_pay_types: [{ data: [], error: null }],
        driver_trip_counts: [{ data: [], error: null }],
        driver_salary_rates: [
          { data: [{ id: 1, driver_id: 1, monthly_salary: "15000", effective_from: "2026-01-01" }], error: null },
        ],
        driver_salary_entries: [{ data: [], error: null }],
      },
      { settle_driver_salary: [{ data: null, error: { code: "23505", message: "duplicate key" } }] },
    );
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, { period_month: "2026-06", amount_paid: 15000 }),
      paramsFor("1"),
    );

    expect(res.status).toBe(409);
  });

  // Regression coverage for the pre-RPC code path: sql/ files are applied by
  // hand, so a database that hasn't run sql/50's functions yet must still
  // settle correctly via the three separate (non-atomic) writes.
  describe("fallback when settle_driver_salary does not exist in the database yet", () => {
    it("settles exactly at net pay with no carry-forward entry created", async () => {
      requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
      mockSupabaseAdmin(
        {
          drivers: [
            { data: { id: 1 }, error: null },
            { data: { id: 1, name: "Ravi", place: null, is_active: true }, error: null },
            { data: [{ id: 1, name: "Ravi", place: null, is_active: true }], error: null },
          ],
          driver_salary_settlements: [
            { data: null, error: null }, // existing-settlement check: none
            { data: null, error: null }, // loadDriverSalary's settlement lookup: none
            { data: { id: 50 }, error: null }, // the fallback insert
          ],
          driver_attendance: [{ data: [], error: null }],
          driver_shift_counts: [{ data: [], error: null }],
          driver_pay_types: [{ data: [], error: null }],
          driver_trip_counts: [{ data: [], error: null }],
          driver_salary_rates: [
            { data: [{ id: 1, driver_id: 1, monthly_salary: "15000", effective_from: "2026-01-01" }], error: null },
          ],
          driver_salary_entries: [{ data: [], error: null }],
        },
        { settle_driver_salary: [{ data: null, error: { code: "42883", message: "function does not exist" } }] },
      );
      const { POST } = await importRoute();

      const res = await POST(
        jsonRequest(URL, { period_month: "2026-06", amount_paid: 15000 }),
        paramsFor("1"),
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.settlement.carry_forward_entry_id).toBeNull();
    });

    it("carries an overpayment forward as an ADVANCE and links it back to the settlement", async () => {
      requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
      mockSupabaseAdmin(
        {
          drivers: [
            { data: { id: 1 }, error: null },
            { data: { id: 1, name: "Ravi", place: null, is_active: true }, error: null },
            { data: [{ id: 1, name: "Ravi", place: null, is_active: true }], error: null },
          ],
          driver_salary_settlements: [
            { data: null, error: null }, // existing-settlement check: none
            { data: null, error: null }, // loadDriverSalary's settlement lookup: none
            { data: null, error: null }, // out-of-order guard: next month not settled
            { data: { id: 50 }, error: null }, // the fallback insert
            { data: {}, error: null }, // link update
          ],
          driver_attendance: [{ data: [], error: null }],
          driver_shift_counts: [{ data: [], error: null }],
          driver_pay_types: [{ data: [], error: null }],
          driver_trip_counts: [{ data: [], error: null }],
          driver_salary_rates: [
            { data: [{ id: 1, driver_id: 1, monthly_salary: "15000", effective_from: "2026-01-01" }], error: null },
          ],
          driver_salary_entries: [
            { data: [], error: null }, // loadDriverSalary's entries for the month
            { data: { id: 77 }, error: null }, // the carry-forward insert
          ],
        },
        { settle_driver_salary: [{ data: null, error: { code: "PGRST202", message: "not found" } }] },
      );
      const { POST } = await importRoute();

      const res = await POST(
        jsonRequest(URL, { period_month: "2026-06", amount_paid: 20000 }),
        paramsFor("1"),
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.settlement.carry_forward_entry_id).toBe(77);
      expect(body.message).toMatch(/overpayment carried/);
    });

    it("409s when the next month is already settled", async () => {
      requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
      mockSupabaseAdmin(
        {
          drivers: [
            { data: { id: 1 }, error: null },
            { data: { id: 1, name: "Ravi", place: null, is_active: true }, error: null },
            { data: [{ id: 1, name: "Ravi", place: null, is_active: true }], error: null },
          ],
          driver_salary_settlements: [
            { data: null, error: null }, // existing-settlement check: none
            { data: null, error: null }, // loadDriverSalary's settlement lookup: none
            { data: { id: 99 }, error: null }, // out-of-order guard: July is already settled
          ],
          driver_attendance: [{ data: [], error: null }],
          driver_shift_counts: [{ data: [], error: null }],
          driver_pay_types: [{ data: [], error: null }],
          driver_trip_counts: [{ data: [], error: null }],
          driver_salary_rates: [
            { data: [{ id: 1, driver_id: 1, monthly_salary: "15000", effective_from: "2026-01-01" }], error: null },
          ],
          driver_salary_entries: [{ data: [], error: null }],
        },
        { settle_driver_salary: [{ data: null, error: { code: "PGRST202", message: "not found" } }] },
      );
      const { POST } = await importRoute();

      // Driver owed 15000, paid 20000 — overpaid, would carry into July.
      const res = await POST(
        jsonRequest(URL, { period_month: "2026-06", amount_paid: 20000 }),
        paramsFor("1"),
      );

      expect(res.status).toBe(409);
    });
  });

  it("409s when the RPC reports the next month is already settled", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {
        drivers: [
          { data: { id: 1 }, error: null },
          { data: { id: 1, name: "Ravi", place: null, is_active: true }, error: null },
          { data: [{ id: 1, name: "Ravi", place: null, is_active: true }], error: null },
        ],
        driver_salary_settlements: [{ data: null, error: null }, { data: null, error: null }],
        driver_attendance: [{ data: [], error: null }],
        driver_shift_counts: [{ data: [], error: null }],
        driver_pay_types: [{ data: [], error: null }],
        driver_trip_counts: [{ data: [], error: null }],
        driver_salary_rates: [
          { data: [{ id: 1, driver_id: 1, monthly_salary: "15000", effective_from: "2026-01-01" }], error: null },
        ],
        driver_salary_entries: [{ data: [], error: null }],
      },
      {
        settle_driver_salary: [
          { data: null, error: { code: "P0001", message: "next_month_settled" } },
        ],
      },
    );
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, { period_month: "2026-06", amount_paid: 20000 }),
      paramsFor("1"),
    );

    expect(res.status).toBe(409);
  });
});
