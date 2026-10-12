import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const params = (driverId: string, entryId?: string) => ({
  params: Promise.resolve(entryId ? { driverId, entryId } : { driverId }),
}) as never;

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
  // 12 Oct 2026, mid-morning IST — "today" and "this month" are fixed.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T05:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/driver-salaries", () => {
  it("is admin-only, GET included", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await import("@/app/api/driver-salaries/route");

    const res = await GET(new NextRequest("http://localhost/api/driver-salaries?month=2026-09"));

    expect(res.status).toBe(403);
  });

  it("refuses a month that hasn't started and a malformed month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await import("@/app/api/driver-salaries/route");

    expect((await GET(new NextRequest("http://localhost/api/driver-salaries?month=2026-11"))).status).toBe(400);
    expect((await GET(new NextRequest("http://localhost/api/driver-salaries?month=2026-13"))).status).toBe(400);
  });

  it("works the sheet out from salary, attendance and live entries", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        {
          data: [
            { id: 1, name: "Ramesh", place: "Guntur", is_active: true },
            { id: 2, name: "Suresh", place: null, is_active: true },
          ],
          error: null,
        },
      ],
      // Nobody has had their shifts changed, so every driver runs all three.
      driver_shift_counts: [{ data: [], error: null }],
      // September 2026 (30 days): Ramesh absent twice and on leave once.
      driver_attendance: [
        {
          data: [
            { driver_id: 1, attendance_date: "2026-09-01", status: "PRESENT", shift_a: true, shift_b: true, shift_c: true },
            { driver_id: 1, attendance_date: "2026-09-02", status: "ABSENT", shift_a: false, shift_b: false, shift_c: false },
            { driver_id: 1, attendance_date: "2026-09-03", status: "ABSENT", shift_a: false, shift_b: false, shift_c: false },
            { driver_id: 1, attendance_date: "2026-09-04", status: "LEAVE", shift_a: false, shift_b: false, shift_c: false },
          ],
          error: null,
        },
      ],
      driver_salary_rates: [
        {
          data: [
            { driver_id: 1, monthly_salary: 24000, effective_from: "2026-01-01" },
            { driver_id: 1, monthly_salary: 30000, effective_from: "2026-06-01" },
          ],
          error: null,
        },
      ],
      driver_salary_entries: [
        {
          data: [
            { id: 10, driver_id: 1, entry_type: "ADVANCE", amount: 4000, reverses_entry_id: null },
            { id: 11, driver_id: 1, entry_type: "ADVANCE", amount: 900, reverses_entry_id: null },
            { id: 12, driver_id: 1, entry_type: "ADVANCE", amount: 900, reverses_entry_id: 11 },
            { id: 13, driver_id: 1, entry_type: "DEDUCTION", amount: 500, reverses_entry_id: null },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await import("@/app/api/driver-salaries/route");

    const res = await GET(new NextRequest("http://localhost/api/driver-salaries?month=2026-09"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(
      expect.objectContaining({ month: "2026-09", days_in_month: 30, is_provisional: false }),
    );
    const [ramesh, suresh] = body.data.drivers;
    // 30000 / 30 = 1000 a day; 3 unpaid days; the 900 advance and its reversal cancel.
    expect(ramesh).toEqual(
      expect.objectContaining({
        monthly_salary: 30000,
        days_present: 1,
        absent_days: 2,
        leave_days: 1,
        unpaid_days: 3,
        unmarked_days: 26,
        attendance_cut: 3000,
        advances: 4000,
        deductions: 500,
        net_pay: 22500,
      }),
    );
    // No salary set: nothing to pay, and left out of the totals.
    expect(suresh).toEqual(expect.objectContaining({ monthly_salary: null, net_pay: null }));
    expect(body.data.totals).toEqual({
      monthly_salary: 30000,
      attendance_cut: 3000,
      advances: 4000,
      deductions: 500,
      net_pay: 22500,
      drivers_without_salary: 1,
    });
  });

  it("marks the running month as provisional", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [{ id: 1, name: "Ramesh", place: null, is_active: true }], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_salary_rates: [{ data: [], error: null }],
      driver_salary_entries: [{ data: [], error: null }],
    });
    const { GET } = await import("@/app/api/driver-salaries/route");

    const body = await (await GET(new NextRequest("http://localhost/api/driver-salaries"))).json();

    expect(body.data.month).toBe("2026-10");
    expect(body.data.is_provisional).toBe(true);
    // 12 days of October have happened and none are marked.
    expect(body.data.drivers[0].unmarked_days).toBe(12);
  });
});

describe("POST /api/driver-salaries/[driverId]/rates", () => {
  const url = "http://localhost/api/driver-salaries/1/rates";

  it("rejects a missing salary or month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await import("@/app/api/driver-salaries/[driverId]/rates/route");

    expect((await POST(jsonRequest(url, "POST", { effective_month: "2026-10" }), params("1"))).status).toBe(400);
    expect((await POST(jsonRequest(url, "POST", { monthly_salary: -5, effective_month: "2026-10" }), params("1"))).status).toBe(400);
    expect((await POST(jsonRequest(url, "POST", { monthly_salary: 20000 }), params("1"))).status).toBe(400);
  });

  it("404s for a driver that doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ drivers: [{ data: null, error: null }] });
    const { POST } = await import("@/app/api/driver-salaries/[driverId]/rates/route");

    const res = await POST(
      jsonRequest(url, "POST", { monthly_salary: 20000, effective_month: "2026-10" }),
      params("1"),
    );

    expect(res.status).toBe(404);
  });

  it("adds a new salary from a month and logs it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_salary_rates: [
        { data: null, error: null }, // nothing for that month yet
        { data: { id: 7, driver_id: 1, monthly_salary: 20000, effective_from: "2026-10-01" }, error: null },
      ],
    });
    const { POST } = await import("@/app/api/driver-salaries/[driverId]/rates/route");

    const res = await POST(
      jsonRequest(url, "POST", { monthly_salary: 20000, effective_month: "2026-10" }),
      params("1"),
    );

    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SET_DRIVER_SALARY",
        details: expect.objectContaining({
          monthly_salary: 20000,
          effective_from: "2026-10-01",
          previous_monthly_salary: null,
        }),
      }),
    );
  });

  it("corrects the salary in place when one already starts that month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_salary_rates: [
        { data: { id: 7, monthly_salary: 2000 }, error: null },
        { data: { id: 7, driver_id: 1, monthly_salary: 20000, effective_from: "2026-10-01" }, error: null },
      ],
    });
    const { POST } = await import("@/app/api/driver-salaries/[driverId]/rates/route");

    const res = await POST(
      jsonRequest(url, "POST", { monthly_salary: 20000, effective_month: "2026-10" }),
      params("1"),
    );

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ previous_monthly_salary: 2000 }),
      }),
    );
  });
});

describe("POST /api/driver-salaries/[driverId]/entries", () => {
  const url = "http://localhost/api/driver-salaries/1/entries";
  const valid = { entry_type: "ADVANCE", amount: 2000, entry_date: "2026-10-05", period_month: "2026-10" };

  it("rejects a bad type, amount, future date or future salary month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await import("@/app/api/driver-salaries/[driverId]/entries/route");
    const post = (body: unknown) => POST(jsonRequest(url, "POST", body), params("1"));

    expect((await post({ ...valid, entry_type: "BONUS" })).status).toBe(400);
    expect((await post({ ...valid, amount: 0 })).status).toBe(400);
    expect((await post({ ...valid, entry_date: "2026-10-13" })).status).toBe(400);
    expect((await post({ ...valid, period_month: "2026-11" })).status).toBe(400);
  });

  it("records an advance against the chosen salary month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_salary_entries: [{ data: { id: 30, ...valid }, error: null }],
    });
    const { POST } = await import("@/app/api/driver-salaries/[driverId]/entries/route");

    // Handed over on 5 Oct, but against September's pay.
    const res = await POST(
      jsonRequest(url, "POST", { ...valid, period_month: "2026-09" }),
      params("1"),
    );

    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE_DRIVER_SALARY_ENTRY",
        details: expect.objectContaining({ entry_type: "ADVANCE", amount: 2000, period_month: "2026-09" }),
      }),
    );
  });
});

describe("POST /api/driver-salaries/[driverId]/entries/[entryId]/reverse", () => {
  const url = "http://localhost/api/driver-salaries/1/entries/30/reverse";

  it("refuses an entry that belongs to another driver", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_entries: [{ data: { id: 30, driver_id: 2, reverses_entry_id: null }, error: null }],
    });
    const { POST } = await import(
      "@/app/api/driver-salaries/[driverId]/entries/[entryId]/reverse/route"
    );

    const res = await POST(jsonRequest(url, "POST", {}), params("1", "30"));

    expect(res.status).toBe(400);
  });

  it("409s on a second reversal of the same entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_entries: [
        { data: { id: 30, driver_id: 1, reverses_entry_id: null }, error: null },
        { data: { id: 31 }, error: null }, // a reversal already exists
      ],
    });
    const { POST } = await import(
      "@/app/api/driver-salaries/[driverId]/entries/[entryId]/reverse/route"
    );

    const res = await POST(jsonRequest(url, "POST", {}), params("1", "30"));

    expect(res.status).toBe(409);
  });

  it("inserts the cancelling row and logs it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_entries: [
        {
          data: { id: 30, driver_id: 1, entry_type: "ADVANCE", amount: 2000, period_month: "2026-10-01", reverses_entry_id: null },
          error: null,
        },
        { data: null, error: null }, // not reversed yet
        { data: { id: 31, reverses_entry_id: 30 }, error: null },
      ],
    });
    const { POST } = await import(
      "@/app/api/driver-salaries/[driverId]/entries/[entryId]/reverse/route"
    );

    const res = await POST(jsonRequest(url, "POST", { reason: "entered twice" }), params("1", "30"));

    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "REVERSE_DRIVER_SALARY_ENTRY",
        details: expect.objectContaining({ reversed_entry_id: 30, reason: "entered twice" }),
      }),
    );
  });
});
