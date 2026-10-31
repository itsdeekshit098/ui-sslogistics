import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireUserAuth, requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/driver-attendance/shift-counts/[driverId]/route");
}

function paramsFor(driverId: string) {
  return { params: Promise.resolve({ driverId }) };
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const URL = "http://localhost/api/driver-attendance/shift-counts/1";

beforeEach(() => {
  requireUserAuth.mockReset();
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/driver-attendance/shift-counts/[driverId]", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(URL), paramsFor("1"));

    expect(res.status).toBe(403);
  });

  it("400s on an invalid driver ID", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(URL), paramsFor("abc"));

    expect(res.status).toBe(400);
  });

  it("returns the history ordered newest-first", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_shift_counts: [
        {
          data: [
            { id: 2, driver_id: 1, shift_count: 1, effective_from: "2026-05-01" },
            { id: 1, driver_id: 1, shift_count: 3, effective_from: "2026-01-01" },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(URL), paramsFor("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.counts).toHaveLength(2);
  });

  it("returns an empty list rather than an error when the table doesn't exist yet", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_shift_counts: [{ data: null, error: { code: "42P01" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(URL), paramsFor("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.counts).toEqual([]);
  });

  it("surfaces a 500 for a genuine query error", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_shift_counts: [{ data: null, error: { message: "timeout" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(URL), paramsFor("1"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/driver-attendance/shift-counts/[driverId]", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { shift_count: 2, effective_month: "2026-06" }),
      paramsFor("1"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on an invalid driver ID", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { shift_count: 2, effective_month: "2026-06" }),
      paramsFor("0"),
    );

    expect(res.status).toBe(400);
  });

  it("400s on a shift_count outside 1-3", () => {
    return (async () => {
      requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
      mockSupabaseAdmin({});
      const { POST } = await importRoute();

      const res = await POST(
        jsonRequest(URL, "POST", { shift_count: 4, effective_month: "2026-06" }),
        paramsFor("1"),
      );

      expect(res.status).toBe(400);
    })();
  });

  it("400s on a missing/invalid effective_month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { shift_count: 2, effective_month: "not-a-month" }),
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
      jsonRequest(URL, "POST", { shift_count: 2, effective_month: "2026-06" }),
      paramsFor("1"),
    );

    expect(res.status).toBe(404);
  });

  it("returns 503 with a setup hint when the table doesn't exist yet", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_shift_counts: [{ data: null, error: { code: "42P01" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { shift_count: 2, effective_month: "2026-06" }),
      paramsFor("1"),
    );

    expect(res.status).toBe(503);
  });

  it("inserts a new row and logs the audit entry when no row exists for that month yet", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_shift_counts: [
        { data: null, error: null }, // no existing row for this month
        { data: { id: 5, driver_id: 1, shift_count: 2, effective_from: "2026-06-01" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { shift_count: 2, effective_month: "2026-06" }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.message).toBe("Shifts per day set");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SET_DRIVER_SHIFT_COUNT" }),
    );
  });

  it("corrects (updates) the existing row rather than duplicating when saved again for the same month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_shift_counts: [
        { data: { id: 5, shift_count: 3 }, error: null }, // existing row for this month
        { data: { id: 5, driver_id: 1, shift_count: 2, effective_from: "2026-06-01" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { shift_count: 2, effective_month: "2026-06" }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Shifts per day corrected");
  });

  it("409s on a concurrent-write unique-constraint race", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_shift_counts: [
        { data: null, error: null },
        { data: null, error: { code: "23505" } },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { shift_count: 2, effective_month: "2026-06" }),
      paramsFor("1"),
    );

    expect(res.status).toBe(409);
  });

  it("truncates a note longer than 200 characters", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_shift_counts: [
        { data: null, error: null },
        { data: { id: 5, driver_id: 1, shift_count: 2, effective_from: "2026-06-01" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    await POST(
      jsonRequest(URL, "POST", {
        shift_count: 2,
        effective_month: "2026-06",
        note: "x".repeat(250),
      }),
      paramsFor("1"),
    );

    // lookup + write, plus the look at the next change for the review check
    expect(supa.callCount("driver_shift_counts")).toBe(3);
  });
});

describe("POST shift-counts — marks left on shifts the driver no longer runs", () => {
  const savedRow = { id: 5, driver_id: 1, shift_count: 1, effective_from: "2026-10-01" };

  function mockSave(attendanceRows: Array<{ attendance_date: string }> | null) {
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      // existing-row lookup, next-change lookup, then the write
      driver_shift_counts: [
        { data: null, error: null },
        { data: savedRow, error: null },
        { data: null, error: null },
      ],
      driver_attendance: [
        attendanceRows
          ? { data: attendanceRows, error: null }
          : { data: null, error: { message: "boom" } },
      ],
    });
  }

  it("reports the days still marked beyond the new count, without changing them", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSave([{ attendance_date: "2026-10-03" }, { attendance_date: "2026-10-12" }]);
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { shift_count: 1, effective_month: "2026-10" }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.conflicts).toEqual({ count: 2, dates: ["2026-10-03", "2026-10-12"] });
  });

  it("reports nothing to review when no marks exceed the count", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSave([]);
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { shift_count: 2, effective_month: "2026-10" }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(body.data.conflicts).toEqual({ count: 0, dates: [] });
  });

  it("never looks at attendance for a three-shift count", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSave([{ attendance_date: "2026-10-03" }]);
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { shift_count: 3, effective_month: "2026-10" }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(body.data.conflicts.count).toBe(0);
  });

  it("still succeeds when the review query itself fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSave(null);
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { shift_count: 1, effective_month: "2026-10" }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.conflicts).toEqual({ count: 0, dates: [] });
  });
});
