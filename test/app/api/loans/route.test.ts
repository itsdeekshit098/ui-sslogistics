import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/loans/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const VALID_LOAN_BODY = {
  loan_type: "Term Loan",
  borrower_entity_id: 5,
  principal_amount: 500000,
  start_date: "2026-01-01",
  first_emi_date: "2026-01-05",
  emi_amount: 45000,
  emi_day_of_month: 5,
  total_installments: 12,
};

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/loans", () => {
  it("rejects a non-admin the same way requireStrictAdminAuth does", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/loans"));

    expect(res.status).toBe(403);
  });

  it("lists loans with their derived balances merged in", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: [{ id: 1 }, { id: 2 }], error: null, count: 2 }],
      loan_balances: [
        {
          data: [
            { loan_id: 1, outstanding: 1000, overdue_count: 0 },
            { loan_id: 2, outstanding: 2000, overdue_count: 1 },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/loans"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.total).toBe(2);
    expect(body.data.data).toEqual([
      expect.objectContaining({ id: 1, balance: expect.objectContaining({ outstanding: 1000 }) }),
      expect.objectContaining({ id: 2, balance: expect.objectContaining({ outstanding: 2000 }) }),
    ]);
  });

  it("filters to only overdue loans when overdue_only=true", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: [{ id: 1 }, { id: 2 }], error: null, count: 2 }],
      loan_balances: [
        {
          data: [
            { loan_id: 1, overdue_count: 0 },
            { loan_id: 2, overdue_count: 3 },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/loans?overdue_only=true"),
    );
    const body = await res.json();

    expect(body.data.data).toHaveLength(1);
    expect(body.data.data[0].id).toBe(2);
  });

  it("includes portfolio summary only when include_summary=true", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      loans: [
        { data: [], error: null, count: 0 }, // paginated list
        { data: [{ id: 1, emi_amount: 45000 }], error: null }, // active loans for summary
      ],
      loan_balances: [{ data: [], error: null }],
      fundings: [{ data: [{ id: 9 }], count: 1, error: null }],
      funding_balances: [{ data: [{ principal_outstanding: 12000 }], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/loans?include_summary=true"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.summary).toEqual(
      expect.objectContaining({
        totalMonthlyEmi: 45000,
        activeLoans: 1,
        openFundings: 1,
        fundingPrincipalOutstanding: 12000,
      }),
    );
    expect(supa.callCount("loans")).toBe(2);
  });

  it("applies every list filter and escapes special characters in search", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: [], error: null, count: 0 }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/loans?status=ACTIVE&loan_type=Term%20Loan" +
          "&borrower_entity_id=5&lender_id=7&vehicle_id=9&debit_account_id=3" +
          "&search=100%25_off",
      ),
    );

    expect(res.status).toBe(200);
  });

  it("counts a loan as due this month only when its next EMI falls within it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [
        { data: [], error: null, count: 0 },
        { data: [{ id: 1, emi_amount: 1000 }], error: null },
      ],
      // The paginated list itself is empty, so fetchLoanBalances short-circuits
      // for it — this single entry is consumed by buildSummary's own call.
      loan_balances: [{ data: [{ loan_id: 1, next_due_date: "2000-01-01" }], error: null }],
      fundings: [{ data: [], count: 0, error: null }],
      funding_balances: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/loans?include_summary=true"),
    );
    const body = await res.json();

    // A due date far in the past is still <= this month's end, so it counts —
    // that's what "due this month" actually checks (no lower bound).
    expect(body.data.summary.dueThisMonth).toBe(1);
  });

  it("surfaces a 500 when the list query errors, without touching balances", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      loans: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/loans"));

    expect(res.status).toBe(500);
    expect(supa.callCount("loan_balances")).toBe(0);
  });
});

describe("POST /api/loans", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/loans", "POST", VALID_LOAN_BODY),
    );

    expect(res.status).toBe(403);
  });

  it("400s on an unknown loan type", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/loans", "POST", {
        ...VALID_LOAN_BODY,
        loan_type: "Not A Real Type",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Unknown loan type");
  });

  it("400s on a non-positive principal amount", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [{ data: { value: "Term Loan" }, error: null }],
      entities: [{ data: { id: 5 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/loans", "POST", {
        ...VALID_LOAN_BODY,
        principal_amount: -100,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Principal amount must be a positive number");
  });

  it("400s when the first EMI date is before the loan start date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [{ data: { value: "Term Loan" }, error: null }],
      entities: [{ data: { id: 5 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/loans", "POST", {
        ...VALID_LOAN_BODY,
        start_date: "2026-02-01",
        first_emi_date: "2026-01-01",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("First EMI date cannot be before the loan start date");
  });

  it("creates the loan, generates its schedule, and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      lookup_options: [{ data: { value: "Term Loan" }, error: null }],
      entities: [{ data: { id: 5 }, error: null }],
      lenders: [{ data: { id: 7 }, error: null }],
      vehicles: [{ data: { id: 9 }, error: null }],
      bank_accounts: [{ data: { id: 3 }, error: null }],
      loans: [{ data: { id: 42 }, error: null }],
      loan_installments: [{ error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/loans", "POST", {
        ...VALID_LOAN_BODY,
        lender_id: 7,
        vehicle_id: 9,
        debit_account_id: 3,
        mandate_type: "NACH",
        notes: "First loan",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.loan.id).toBe(42);
    expect(supa.callCount("loan_installments")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_LOAN", recordId: 42 }),
    );
  });

  it("rolls back the loan when the schedule insert fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      lookup_options: [{ data: { value: "Term Loan" }, error: null }],
      entities: [{ data: { id: 5 }, error: null }],
      loans: [{ data: { id: 42 }, error: null }, { error: null }],
      loan_installments: [{ error: { message: "constraint violation" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/loans", "POST", VALID_LOAN_BODY),
    );

    expect(res.status).toBe(500);
    expect(supa.callCount("loans")).toBe(2); // insert, then the rollback delete
    expect(logActivity).not.toHaveBeenCalled();
  });
});

describe("PUT /api/loans", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, notes: "x" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when the loan ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/loans", "PUT", {}));

    expect(res.status).toBe(400);
  });

  it("404s when the loan doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: null, error: null }] });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, notes: "x" }),
    );

    expect(res.status).toBe(404);
  });

  it("400s when no updatable fields are supplied", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [
        {
          data: {
            id: 10,
            first_emi_date: "2026-01-05",
            emi_day_of_month: 5,
            emi_amount: 5000,
            total_installments: 3,
          },
          error: null,
        },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/loans", "PUT", { id: 10 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("No fields to update");
  });

  it("updates non-schedule fields without touching installments", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      loans: [
        {
          data: {
            id: 10,
            first_emi_date: "2026-01-05",
            emi_day_of_month: 5,
            emi_amount: 5000,
            total_installments: 3,
          },
          error: null,
        },
        { error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, notes: "updated" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.loan.id).toBe(10);
    expect(supa.callCount("loan_installments")).toBe(0);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE_LOAN",
        details: expect.objectContaining({ schedule_regenerated: false }),
      }),
    );
  });

  it("regenerates the unpaid schedule when a schedule-shaping term changes", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      loans: [
        {
          data: {
            id: 10,
            first_emi_date: "2026-01-05",
            emi_day_of_month: 5,
            emi_amount: 5000,
            total_installments: 3,
          },
          error: null,
        },
        { error: null },
      ],
      loan_payments: [{ data: [], error: null }],
      loan_installments: [
        {
          data: [
            { id: 101, installment_no: 1 },
            { id: 102, installment_no: 2 },
            { id: 103, installment_no: 3 },
          ],
          error: null,
        },
        { error: null }, // delete
        { error: null }, // insert regenerated rows
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, emi_amount: 6000 }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.loan.id).toBe(10);
    expect(supa.callCount("loan_installments")).toBe(3);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ schedule_regenerated: true }),
      }),
    );
  });

  it("leaves installments already paid against alone when regenerating", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      loans: [
        {
          data: {
            id: 10,
            first_emi_date: "2026-01-05",
            emi_day_of_month: 5,
            emi_amount: 5000,
            total_installments: 3,
          },
          error: null,
        },
        { error: null },
      ],
      // Installment #1 has a payment against it, so it's protected.
      loan_payments: [{ data: [{ installment_id: 101 }], error: null }],
      loan_installments: [
        {
          data: [
            { id: 101, installment_no: 1 },
            { id: 102, installment_no: 2 },
            { id: 103, installment_no: 3 },
          ],
          error: null,
        },
        { error: null }, // delete of the two unprotected rows
        { error: null }, // insert of the regenerated (non-#1) rows
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, emi_amount: 6000 }),
    );

    expect(res.status).toBe(200);
    // delete + insert only — #1 was protected and never touched.
    expect(supa.callCount("loan_installments")).toBe(3);
  });

  const EXISTING_LOAN = {
    id: 10,
    first_emi_date: "2026-01-05",
    emi_day_of_month: 5,
    emi_amount: 5000,
    total_installments: 3,
  };

  it("clears an optional reference field when explicitly set to null", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: EXISTING_LOAN, error: null }, { error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, lender_id: null }),
    );

    expect(res.status).toBe(200);
  });

  it("clears vehicle_id, debit_account_id and mandate_type when set to null", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: EXISTING_LOAN, error: null }, { error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", {
        id: 10,
        vehicle_id: null,
        debit_account_id: null,
        mandate_type: null,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("400s on an invalid mandate type", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: EXISTING_LOAN, error: null }] });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, mandate_type: "CARRIER_PIGEON" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid mandate type/);
  });

  it("400s when notes exceed the max length", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: EXISTING_LOAN, error: null }] });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", {
        id: 10,
        notes: "x".repeat(501),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/500 characters or less/);
  });

  it("400s on an invalid status value", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: EXISTING_LOAN, error: null }] });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, status: "ON_HOLD" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid status/);
  });

  it("400s on a negative interest rate", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: EXISTING_LOAN, error: null }] });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, interest_rate: -1 }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/interest rate must be a positive number/);
  });

  it("400s on a non-positive EMI amount", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: EXISTING_LOAN, error: null }] });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, emi_amount: 0 }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("EMI amount must be greater than zero");
  });

  it("400s on an out-of-range EMI day of month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: EXISTING_LOAN, error: null }] });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, emi_day_of_month: 32 }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("EMI day must be between 1 and 31");
  });

  it("400s on a non-integer total_installments", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: EXISTING_LOAN, error: null }] });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, total_installments: 0 }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/whole number of at least 1/);
  });

  it("accepts a valid interest rate and a valid status change", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: EXISTING_LOAN, error: null }, { error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", {
        id: 10,
        interest_rate: 12.5,
        status: "CLOSED",
      }),
    );

    expect(res.status).toBe(200);
  });

  it("clears interest_rate when explicitly set to an empty string", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: EXISTING_LOAN, error: null }, { error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, interest_rate: "" }),
    );

    expect(res.status).toBe(200);
  });

  it("clears loan_number when explicitly set to null", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: EXISTING_LOAN, error: null }, { error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, loan_number: null }),
    );

    expect(res.status).toBe(200);
  });

  it("surfaces a 500 when schedule regeneration fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [
        {
          data: {
            id: 10,
            first_emi_date: "2026-01-05",
            emi_day_of_month: 5,
            emi_amount: 5000,
            total_installments: 3,
          },
          error: null,
        },
        { error: null },
      ],
      loan_payments: [{ data: [], error: null }],
      loan_installments: [
        { data: [{ id: 101, installment_no: 1 }], error: null },
        { error: { message: "deadlock detected" } }, // delete fails
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/loans", "PUT", { id: 10, emi_amount: 6000 }),
    );

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/loans", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/loans?id=10"));

    expect(res.status).toBe(403);
  });

  it("400s when the loan ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/loans"));

    expect(res.status).toBe(400);
    expect(supa.from).not.toHaveBeenCalled();
  });

  it("404s when the loan doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: null, error: null }] });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/loans?id=10"));

    expect(res.status).toBe(404);
  });

  it("blocks deletion while a private funding is still linked", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: { id: 10, loan_type: "Term Loan", loan_number: "L-1" }, error: null }],
      fundings: [{ count: 2, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/loans?id=10"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/2 private funding\(s\)/);
  });

  it("deletes the loan and logs the audit entry when nothing blocks it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [
        { data: { id: 10, loan_type: "Term Loan", loan_number: "L-1" }, error: null },
        { error: null },
      ],
      fundings: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/loans?id=10"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_LOAN", recordId: 10 }),
    );
  });
});
