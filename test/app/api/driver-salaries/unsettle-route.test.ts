import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/driver-salaries/[driverId]/settle/[settlementId]/route");
}

function paramsFor(driverId: string, settlementId: string) {
  return { params: Promise.resolve({ driverId, settlementId }) };
}

const URL = "http://localhost/api/driver-salaries/1/settle/50";

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("DELETE /api/driver-salaries/[driverId]/settle/[settlementId]", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest(URL, { method: "DELETE" }), paramsFor("1", "50"));

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric driver or settlement ID", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest(URL, { method: "DELETE" }), paramsFor("abc", "50"));

    expect(res.status).toBe(400);
  });

  it("404s when the settlement does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_settlements: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest(URL, { method: "DELETE" }), paramsFor("1", "50"));

    expect(res.status).toBe(404);
  });

  it("400s when the settlement belongs to a different driver", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      driver_salary_settlements: [
        { data: { id: 50, driver_id: 999, period_month: "2026-06-01", carry_forward_entry_id: null }, error: null },
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest(URL, { method: "DELETE" }), paramsFor("1", "50"));

    expect(res.status).toBe(400);
  });

  // The happy path goes through unsettle_driver_salary (sql/50) in one
  // transaction: the up-front fetch (for the 404/ownership checks) still
  // uses .from(), then the write is one .rpc() call.
  it("undoes a settlement via the RPC and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin(
      {
        driver_salary_settlements: [
          { data: { id: 50, driver_id: 1, period_month: "2026-06-01", carry_forward_entry_id: 77 }, error: null },
        ],
      },
      { unsettle_driver_salary: [{ data: null, error: null }] },
    );
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest(URL, { method: "DELETE" }), paramsFor("1", "50"));

    expect(res.status).toBe(200);
    expect(supa.rpcCallCount("unsettle_driver_salary")).toBe(1);
    // No fallback writes — the RPC did the whole thing in one transaction.
    expect(supa.callCount("driver_salary_entries")).toBe(0);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UNSETTLE_DRIVER_SALARY" }),
    );
  });

  it("500s when the RPC fails for a reason other than the function missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {
        driver_salary_settlements: [
          { data: { id: 50, driver_id: 1, period_month: "2026-06-01", carry_forward_entry_id: null }, error: null },
        ],
      },
      { unsettle_driver_salary: [{ data: null, error: { code: "XX000", message: "boom" } }] },
    );
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest(URL, { method: "DELETE" }), paramsFor("1", "50"));

    expect(res.status).toBe(500);
  });

  // Regression coverage for the pre-RPC code path: sql/ files are applied by
  // hand, so a database that hasn't run sql/50's functions yet must still
  // undo a settlement correctly via the separate (non-atomic) writes.
  describe("fallback when unsettle_driver_salary does not exist in the database yet", () => {
    it("deletes a settlement with no carry-forward entry, without touching driver_salary_entries", async () => {
      requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
      const supa = mockSupabaseAdmin(
        {
          driver_salary_settlements: [
            { data: { id: 50, driver_id: 1, period_month: "2026-06-01", carry_forward_entry_id: null }, error: null },
            { data: null, error: null }, // the fallback delete
          ],
        },
        { unsettle_driver_salary: [{ data: null, error: { code: "42883", message: "function does not exist" } }] },
      );
      const { DELETE } = await importRoute();

      const res = await DELETE(new NextRequest(URL, { method: "DELETE" }), paramsFor("1", "50"));

      expect(res.status).toBe(200);
      expect(supa.callCount("driver_salary_entries")).toBe(0);
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: "UNSETTLE_DRIVER_SALARY" }),
      );
    });

    it("reverses the carry-forward entry before deleting the settlement", async () => {
      requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
      mockSupabaseAdmin(
        {
          driver_salary_settlements: [
            { data: { id: 50, driver_id: 1, period_month: "2026-06-01", carry_forward_entry_id: 77 }, error: null },
            { data: null, error: null }, // the fallback delete
          ],
          driver_salary_entries: [
            { data: { id: 77, entry_type: "ADVANCE", amount: 5000, period_month: "2026-07-01", reverses_entry_id: null }, error: null },
            { data: null, error: null }, // "already reversed?" check: no
            { data: { id: 90 }, error: null }, // the reversal insert
            { data: null, error: null }, // untagging settlement_id on the carry-forward entry
          ],
        },
        { unsettle_driver_salary: [{ data: null, error: { code: "PGRST202", message: "not found" } }] },
      );
      const { DELETE } = await importRoute();

      const res = await DELETE(new NextRequest(URL, { method: "DELETE" }), paramsFor("1", "50"));

      expect(res.status).toBe(200);
    });

    it("skips reversing an already-reversed carry-forward entry", async () => {
      requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
      const supa = mockSupabaseAdmin(
        {
          driver_salary_settlements: [
            { data: { id: 50, driver_id: 1, period_month: "2026-06-01", carry_forward_entry_id: 77 }, error: null },
            { data: null, error: null }, // the fallback delete
          ],
          driver_salary_entries: [
            { data: { id: 77, entry_type: "ADVANCE", amount: 5000, period_month: "2026-07-01", reverses_entry_id: null }, error: null },
            { data: { id: 90 }, error: null }, // already reversed
            { data: null, error: null }, // untagging settlement_id on the carry-forward entry
          ],
        },
        { unsettle_driver_salary: [{ data: null, error: { code: "42883", message: "function does not exist" } }] },
      );
      const { DELETE } = await importRoute();

      const res = await DELETE(new NextRequest(URL, { method: "DELETE" }), paramsFor("1", "50"));

      expect(res.status).toBe(200);
      // Fetch + already-reversed check + the untag update — no reversal insert.
      expect(supa.callCount("driver_salary_entries")).toBe(3);
    });
  });
});
