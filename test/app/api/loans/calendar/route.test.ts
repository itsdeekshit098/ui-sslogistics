import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/loans/calendar/route");
}

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
});

describe("GET /api/loans/calendar", () => {
  it("rejects a non-admin the same way requireStrictAdminAuth does", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/loans/calendar"));

    expect(res.status).toBe(403);
  });

  it("defaults to the bounds of the current month when no dates are given", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_installment_state: [
        { data: [], error: null },
        { data: [], error: null },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/loans/calendar"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.from).toMatch(/^\d{4}-\d{2}-01$/);
    // Same year-month prefix on both ends of the window.
    expect(body.data.to.slice(0, 7)).toBe(body.data.from.slice(0, 7));
  });

  it("honors explicit valid from/to query params", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_installment_state: [
        { data: [], error: null },
        { data: [], error: null },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/loans/calendar?from=2020-01-01&to=2020-01-31",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.from).toBe("2020-01-01");
    expect(body.data.to).toBe("2020-01-31");
  });

  it("falls back to the current-month defaults when from/to are not valid dates", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_installment_state: [
        { data: [], error: null },
        { data: [], error: null },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/loans/calendar?from=not-a-date&to=also-not-a-date",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.from).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("400s when the end date is before the start date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/loans/calendar?from=2020-02-01&to=2020-01-01",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/cannot be before/);
    expect(supa.callCount()).toBe(0);
  });

  it("skips the overdue query entirely when include_overdue=false", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      loan_installment_state: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/loans/calendar?from=2020-01-01&to=2020-01-31&include_overdue=false",
      ),
    );

    expect(res.status).toBe(200);
    expect(supa.callCount("loan_installment_state")).toBe(1);
    expect(supa.callCount("loans")).toBe(0);
  });

  it("surfaces a 500 when the in-window query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_installment_state: [
        { data: null, error: { message: "boom" } },
        { data: [], error: null },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/loans/calendar?from=2020-01-01&to=2020-01-31",
      ),
    );

    expect(res.status).toBe(500);
  });

  it("surfaces a 500 when the overdue query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_installment_state: [
        { data: [], error: null },
        { data: null, error: { message: "boom" } },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/loans/calendar?from=2020-01-01&to=2020-01-31",
      ),
    );

    expect(res.status).toBe(500);
  });

  it("returns an empty calendar without querying loans when nothing is due", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      loan_installment_state: [
        { data: [], error: null },
        { data: [], error: null },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/loans/calendar?from=2020-01-01&to=2020-01-31",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.days).toEqual([]);
    expect(body.data.overdue).toEqual([]);
    expect(body.data.total_due).toBe(0);
    expect(supa.callCount("loans")).toBe(0);
  });

  it("surfaces a 500 when the loans lookup errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_installment_state: [
        {
          data: [
            { id: 1, loan_id: 100, status: "PENDING", due_date: "2020-01-15", amount_remaining: 100 },
          ],
          error: null,
        },
        { data: [], error: null },
      ],
      loans: [{ data: null, error: { message: "boom" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/loans/calendar?from=2020-01-01&to=2020-01-31",
      ),
    );

    expect(res.status).toBe(500);
  });

  it("dedupes overdue/window overlap, drops settled and closed-loan rows, groups by day and totals correctly", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      loan_installment_state: [
        // in-window
        {
          data: [
            { id: 1, loan_id: 100, status: "PENDING", due_date: "2099-01-05", amount_remaining: 1000 },
            { id: 2, loan_id: 100, status: "PENDING", due_date: "2099-01-05", amount_remaining: 2000 },
            { id: 3, loan_id: 200, status: "PAID", due_date: "2099-01-06", amount_remaining: 500 },
            { id: 5, loan_id: 400, status: "PENDING", due_date: "2099-01-07", amount_remaining: 300 },
          ],
          error: null,
        },
        // overdue (id 1 duplicates the window row and should be deduped)
        {
          data: [
            { id: 1, loan_id: 100, status: "PENDING", due_date: "2099-01-05", amount_remaining: 1000 },
            { id: 4, loan_id: 100, status: "OVERDUE", due_date: "2020-01-01", amount_remaining: 500 },
          ],
          error: null,
        },
      ],
      loans: [
        {
          data: [
            { id: 100, status: "ACTIVE", loan_type: "Term Loan", loan_number: "L-100" },
            { id: 400, status: "CLOSED", loan_type: "Term Loan", loan_number: "L-400" },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/loans/calendar?from=2020-01-01&to=2099-12-31",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(supa.callCount("loans")).toBe(1);

    // id=3 was PAID (dropped), id=5 belonged to a CLOSED loan (dropped).
    expect(body.data.total_due).toBe(3500);

    expect(body.data.days).toHaveLength(2);
    expect(body.data.days[0]).toEqual(
      expect.objectContaining({ date: "2020-01-01", is_overdue: true, total: 500 }),
    );
    expect(body.data.days[0].installments).toHaveLength(1);
    expect(body.data.days[1]).toEqual(
      expect.objectContaining({ date: "2099-01-05", is_overdue: false, total: 3000 }),
    );
    expect(body.data.days[1].installments).toHaveLength(2);

    // overdueRows is derived from the full enriched set, not just the overdue query.
    expect(body.data.overdue).toHaveLength(1);
    expect(body.data.overdue[0].id).toBe(4);
  });
});
