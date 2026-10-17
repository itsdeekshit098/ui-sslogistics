import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import(
    "@/app/api/driver-salaries/[driverId]/entries/[entryId]/reverse/route"
  );
}

function paramsFor(driverId: string, entryId: string) {
  return { params: Promise.resolve({ driverId, entryId }) };
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const URL = "http://localhost/api/driver-salaries/1/entries/5/reverse";

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("POST .../entries/[entryId]/reverse", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST", {}), paramsFor("1", "5"));

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric driver or entry ID", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST", {}), paramsFor("abc", "5"));

    expect(res.status).toBe(400);
  });

  it("404s when the entry does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_entries: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST", {}), paramsFor("1", "5"));

    expect(res.status).toBe(404);
  });

  it("400s when the entry belongs to a different driver", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_entries: [
        // The route's own pre-check filters by driver_id, so it finds
        // nothing for driver 1; reverseLedgerEntry's own fetch (no driver
        // filter) then finds the real row and catches the mismatch.
        { data: null, error: null },
        { data: { id: 5, driver_id: 999, entry_type: "ADVANCE", amount: 1000, period_month: "2026-06-01", reverses_entry_id: null }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST", {}), paramsFor("1", "5"));

    expect(res.status).toBe(400);
  });

  it("400s when trying to reverse a carry-forward entry directly", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_entries: [
        { data: { period_month: "2026-06-01", settlement_id: 50, reverses_entry_id: null }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST", {}), paramsFor("1", "5"));

    expect(res.status).toBe(400);
  });

  it("409s when the entry's month is already settled", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_entries: [
        { data: { period_month: "2026-06-01", settlement_id: null, reverses_entry_id: null }, error: null },
      ],
      driver_salary_settlements: [{ data: { id: 50 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST", {}), paramsFor("1", "5"));

    expect(res.status).toBe(409);
  });

  it("400s when trying to reverse a reversal", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_entries: [
        { data: { period_month: "2026-06-01", settlement_id: null, reverses_entry_id: 1 }, error: null },
        { data: { id: 5, driver_id: 1, entry_type: "ADVANCE", amount: 1000, period_month: "2026-06-01", reverses_entry_id: 1 }, error: null },
      ],
      driver_salary_settlements: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST", {}), paramsFor("1", "5"));

    expect(res.status).toBe(400);
  });

  it("409s when the entry was already reversed", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_entries: [
        { data: { period_month: "2026-06-01", settlement_id: null, reverses_entry_id: null }, error: null },
        { data: { id: 5, driver_id: 1, entry_type: "ADVANCE", amount: 1000, period_month: "2026-06-01", reverses_entry_id: null }, error: null },
        { data: { id: 99 }, error: null },
      ],
      driver_salary_settlements: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST", {}), paramsFor("1", "5"));

    expect(res.status).toBe(409);
  });

  it("reverses the entry, appends the optional reason, and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_entries: [
        { data: { period_month: "2026-06-01", settlement_id: null, reverses_entry_id: null }, error: null },
        { data: { id: 5, driver_id: 1, entry_type: "ADVANCE", amount: 1000, period_month: "2026-06-01", reverses_entry_id: null }, error: null },
        { data: null, error: null },
        { data: { id: 6, driver_id: 1, entry_type: "ADVANCE", amount: 1000, period_month: "2026-06-01", reverses_entry_id: 5 }, error: null },
      ],
      driver_salary_settlements: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { reason: "Entered twice by mistake" }),
      paramsFor("1", "5"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.entry.id).toBe(6);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "REVERSE_DRIVER_SALARY_ENTRY" }),
    );
  });

  it("works with no body/reason supplied at all", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_entries: [
        { data: { period_month: "2026-06-01", settlement_id: null, reverses_entry_id: null }, error: null },
        { data: { id: 5, driver_id: 1, entry_type: "ADVANCE", amount: 1000, period_month: "2026-06-01", reverses_entry_id: null }, error: null },
        { data: null, error: null },
        { data: { id: 6, driver_id: 1, entry_type: "ADVANCE", amount: 1000, period_month: "2026-06-01", reverses_entry_id: 5 }, error: null },
      ],
      driver_salary_settlements: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(new NextRequest(URL, { method: "POST" }), paramsFor("1", "5"));

    expect(res.status).toBe(201);
  });
});
