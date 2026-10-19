import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireUserAuth, requireStrictAdminAuth, isAdmin } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, STAFF_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/driver-attendance/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const DRIVERS_ROW = { id: 1, name: "Ravi", place: "Chennai", is_active: true };

beforeEach(() => {
  requireUserAuth.mockReset();
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T10:00:00Z")); // well within the IST day
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/driver-attendance", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/driver-attendance"));

    expect(res.status).toBe(403);
  });

  it("allows staff and driver roles to read (reading is open to every role)", async () => {
    requireUserAuth.mockResolvedValue(STAFF_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [DRIVERS_ROW], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_pay_types: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-attendance?date=2026-06-15"),
    );

    expect(res.status).toBe(200);
  });

  it("400s on an invalid date", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-attendance?date=2026-02-30"),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid month", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-attendance?month=2026-13"),
    );

    expect(res.status).toBe(400);
  });

  it("returns a day with editable=true for an admin on today's date", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [DRIVERS_ROW], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_pay_types: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-attendance?date=2026-06-15"),
    );
    const body = await res.json();

    expect(body.data.editable).toBe(true);
  });

  it("returns a day with editable=false for staff — reading is open, marking is not", async () => {
    requireUserAuth.mockResolvedValue(STAFF_USER);
    isAdmin.mockReturnValueOnce(false); // authMock's isAdmin defaults to true; override for this one check
    mockSupabaseAdmin({
      drivers: [{ data: [DRIVERS_ROW], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_pay_types: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-attendance?date=2026-06-15"),
    );
    const body = await res.json();

    expect(body.data.editable).toBe(false);
  });

  it("returns a day with editable=false for an admin on a past date that is otherwise fine, when explicitly in the future", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [DRIVERS_ROW], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_pay_types: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-attendance?date=2026-06-20"),
    );
    const body = await res.json();

    expect(body.data.editable).toBe(false);
  });

  it("returns the month register when ?month= is given", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [DRIVERS_ROW], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_pay_types: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-attendance?month=2026-06"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.month).toBe("2026-06");
  });
});

describe("PUT /api/driver-attendance", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/driver-attendance", "PUT", {
        date: "2026-06-15",
        entries: [{ driver_id: 1, shifts: ["A"], status: null }],
      }),
    );

    expect(res.status).toBe(403);
  });

  it("400s on an invalid date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/driver-attendance", "PUT", {
        date: "not-a-date",
        entries: [],
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when marking a future date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/driver-attendance", "PUT", {
        date: "2026-06-20",
        entries: [{ driver_id: 1, shifts: ["A"], status: null }],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/future date/);
  });

  it("400s when entries is empty", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/driver-attendance", "PUT", {
        date: "2026-06-15",
        entries: [],
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when entries exceeds the max count", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_shift_counts: [{ data: [], error: null }],
      driver_pay_types: [{ data: [], error: null }],
    });
    const { PUT } = await importRoute();

    const entries = Array.from({ length: 501 }, (_, i) => ({
      driver_id: i + 1,
      shifts: ["A"],
      status: null,
    }));
    const res = await PUT(
      jsonRequest("http://localhost/api/driver-attendance", "PUT", {
        date: "2026-06-15",
        entries,
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid driver ID", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_shift_counts: [{ data: [], error: null }],
      driver_pay_types: [{ data: [], error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/driver-attendance", "PUT", {
        date: "2026-06-15",
        entries: [{ driver_id: "abc", shifts: ["A"], status: null }],
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when the same driver appears twice", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_shift_counts: [{ data: [], error: null }],
      driver_pay_types: [{ data: [], error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/driver-attendance", "PUT", {
        date: "2026-06-15",
        entries: [
          { driver_id: 1, shifts: ["A"], status: null },
          { driver_id: 1, shifts: ["B"], status: null },
        ],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/twice/);
  });

  it("400s when an entry's mark is invalid (bad shift letter)", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_shift_counts: [{ data: [], error: null }],
      driver_pay_types: [{ data: [], error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/driver-attendance", "PUT", {
        date: "2026-06-15",
        entries: [{ driver_id: 1, shifts: ["D"], status: null }],
      }),
    );

    expect(res.status).toBe(400);
  });

  it("rejects a shift the driver doesn't run, rather than silently dropping it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_shift_counts: [
        { data: [{ driver_id: 1, shift_count: 1, effective_from: "2026-01-01" }], error: null },
      ],
      driver_pay_types: [{ data: [], error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/driver-attendance", "PUT", {
        date: "2026-06-15",
        entries: [{ driver_id: 1, shifts: ["B"], status: null }],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/works A only/);
  });

  it("400s when a driver ID no longer exists", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_shift_counts: [{ data: [], error: null }],
      driver_pay_types: [{ data: [], error: null }],
      drivers: [{ data: [], error: null }], // known drivers: none
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/driver-attendance", "PUT", {
        date: "2026-06-15",
        entries: [{ driver_id: 999, shifts: ["A"], status: null }],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/no longer exist/);
  });

  it("saves via the RPC and logs the audit entry on success", async () => {
    mockSupabaseAdmin(
      {
        driver_shift_counts: [{ data: [], error: null }, { data: [], error: null }],
        driver_pay_types: [{ data: [], error: null }, { data: [], error: null }],
        drivers: [
          { data: [{ id: 1 }], error: null }, // known-drivers check
          { data: [DRIVERS_ROW], error: null }, // loadDay's fetchDrivers
        ],
        driver_attendance: [{ data: [], error: null }], // loadDay's fetchRows
      },
      { save_driver_attendance: [{ error: null }] },
    );
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/driver-attendance", "PUT", {
        date: "2026-06-15",
        entries: [{ driver_id: 1, shifts: ["A", "B"], status: null }],
      }),
    );

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MARK_DRIVER_ATTENDANCE" }),
    );
  });
});
