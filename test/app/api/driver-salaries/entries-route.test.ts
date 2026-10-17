import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/driver-salaries/[driverId]/entries/route");
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

const URL = "http://localhost/api/driver-salaries/1/entries";

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/driver-salaries/[driverId]/entries", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { entry_type: "ADVANCE", amount: 1000 }),
      paramsFor("1"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on an invalid entry_type", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { entry_type: "BONUS", amount: 1000 }),
      paramsFor("1"),
    );

    expect(res.status).toBe(400);
  });

  it("400s on a zero or negative amount", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { entry_type: "ADVANCE", amount: 0 }),
      paramsFor("1"),
    );

    expect(res.status).toBe(400);
  });

  it("400s when entry_date is in the future", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", {
        entry_type: "ADVANCE",
        amount: 1000,
        entry_date: "2026-06-20",
      }),
      paramsFor("1"),
    );

    expect(res.status).toBe(400);
  });

  it("400s when period_month is in the future", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", {
        entry_type: "ADVANCE",
        amount: 1000,
        period_month: "2026-08",
      }),
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
      jsonRequest(URL, "POST", { entry_type: "ADVANCE", amount: 1000 }),
      paramsFor("1"),
    );

    expect(res.status).toBe(404);
  });

  it("defaults entry_date to today and period_month to that date's month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_salary_entries: [
        { data: { id: 1, entry_type: "ADVANCE", amount: 1000, entry_date: "2026-06-15", period_month: "2026-06-01" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { entry_type: "ADVANCE", amount: 1000 }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.message).toBe("Advance recorded");
  });

  it("accepts an explicit period_month that differs from entry_date's month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_salary_entries: [
        { data: { id: 1, entry_type: "ADVANCE", amount: 1000 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", {
        entry_type: "ADVANCE",
        amount: 1000,
        entry_date: "2026-06-02",
        period_month: "2026-05",
      }),
      paramsFor("1"),
    );

    expect(res.status).toBe(201);
  });

  it("labels a DEDUCTION entry's success message correctly", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_salary_entries: [
        { data: { id: 1, entry_type: "DEDUCTION", amount: 200 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { entry_type: "DEDUCTION", amount: 200 }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(body.message).toBe("Deduction recorded");
  });

  it("logs the audit entry on success", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_salary_entries: [
        { data: { id: 1, entry_type: "ADVANCE", amount: 1000 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    await POST(
      jsonRequest(URL, "POST", { entry_type: "ADVANCE", amount: 1000 }),
      paramsFor("1"),
    );

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_DRIVER_SALARY_ENTRY" }),
    );
  });
});
