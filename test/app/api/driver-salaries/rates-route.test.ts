import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/driver-salaries/[driverId]/rates/route");
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

const URL = "http://localhost/api/driver-salaries/1/rates";

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("POST /api/driver-salaries/[driverId]/rates", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { monthly_salary: 30000, effective_month: "2026-06" }),
      paramsFor("1"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on an invalid driver ID", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { monthly_salary: 30000, effective_month: "2026-06" }),
      paramsFor("-1"),
    );

    expect(res.status).toBe(400);
  });

  it("400s on a negative monthly_salary", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { monthly_salary: -100, effective_month: "2026-06" }),
      paramsFor("1"),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid effective_month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { monthly_salary: 30000, effective_month: "garbage" }),
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
      jsonRequest(URL, "POST", { monthly_salary: 30000, effective_month: "2026-06" }),
      paramsFor("1"),
    );

    expect(res.status).toBe(404);
  });

  it("409s when the starting month is already settled", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_salary_settlements: [{ data: { id: 50 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { monthly_salary: 30000, effective_month: "2026-06" }),
      paramsFor("1"),
    );

    expect(res.status).toBe(409);
  });

  it("inserts a new rate and logs the audit entry when none exists for that month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_salary_settlements: [{ data: null, error: null }],
      driver_salary_rates: [
        { data: null, error: null },
        { data: { id: 1, driver_id: 1, monthly_salary: 30000, effective_from: "2026-06-01" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { monthly_salary: 30000, effective_month: "2026-06" }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.message).toBe("Salary set");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SET_DRIVER_SALARY" }),
    );
  });

  it("corrects the existing rate when saved again for the same starting month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_salary_settlements: [{ data: null, error: null }],
      driver_salary_rates: [
        { data: { id: 1, monthly_salary: 25000 }, error: null },
        { data: { id: 1, driver_id: 1, monthly_salary: 30000, effective_from: "2026-06-01" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { monthly_salary: 30000, effective_month: "2026-06" }),
      paramsFor("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Salary corrected");
  });

  it("409s on a concurrent-write race", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1 }, error: null }],
      driver_salary_settlements: [{ data: null, error: null }],
      driver_salary_rates: [
        { data: null, error: null },
        { data: null, error: { code: "23505" } },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { monthly_salary: 30000, effective_month: "2026-06" }),
      paramsFor("1"),
    );

    expect(res.status).toBe(409);
  });
});
