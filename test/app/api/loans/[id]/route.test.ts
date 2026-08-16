import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/loans/[id]/route");
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const LOAN_ROW = { id: 10, loan_type: "Term Loan", status: "ACTIVE" };

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
});

describe("GET /api/loans/[id]", () => {
  it("rejects a non-admin the same way requireStrictAdminAuth does", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/loans/10"),
      paramsFor("10"),
    );

    expect(res.status).toBe(403);
  });

  it("400s when the loan ID is not a number", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/loans/abc"),
      paramsFor("abc"),
    );

    expect(res.status).toBe(400);
    expect(supa.callCount("loans")).toBe(0);
  });

  it("surfaces a 500 when the loan lookup errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/loans/10"),
      paramsFor("10"),
    );

    expect(res.status).toBe(500);
  });

  it("404s when the loan doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: null, error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/loans/10"),
      paramsFor("10"),
    );

    expect(res.status).toBe(404);
  });

  it("surfaces a 500 when the installments query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_balances: [{ data: { loan_id: 10 }, error: null }],
      loan_installment_state: [{ data: null, error: { message: "boom" } }],
      loan_payments: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/loans/10"),
      paramsFor("10"),
    );

    expect(res.status).toBe(500);
  });

  it("surfaces a 500 when the payments query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_balances: [{ data: { loan_id: 10 }, error: null }],
      loan_installment_state: [{ data: [], error: null }],
      loan_payments: [{ data: null, error: { message: "boom" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/loans/10"),
      paramsFor("10"),
    );

    expect(res.status).toBe(500);
  });

  it("returns the loan with balance, installments and payments, marking reversed/reversal payments", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_balances: [{ data: { loan_id: 10, outstanding: 40000 }, error: null }],
      loan_installment_state: [
        {
          data: [
            { id: 1, installment_no: 1, status: "PAID" },
            { id: 2, installment_no: 2, status: "PENDING" },
          ],
          error: null,
        },
      ],
      loan_payments: [
        {
          data: [
            { id: 1, reverses_payment_id: null, amount: 5000 },
            { id: 2, reverses_payment_id: 1, amount: 5000 },
            { id: 3, reverses_payment_id: null, amount: 7000 },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/loans/10"),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.loan.id).toBe(10);
    expect(body.data.balance).toEqual({ loan_id: 10, outstanding: 40000 });
    expect(body.data.installments).toHaveLength(2);

    const payment1 = body.data.payments.find((p: { id: number }) => p.id === 1);
    const payment2 = body.data.payments.find((p: { id: number }) => p.id === 2);
    const payment3 = body.data.payments.find((p: { id: number }) => p.id === 3);

    expect(payment1).toEqual(
      expect.objectContaining({ is_reversed: true, is_reversal: false }),
    );
    expect(payment2).toEqual(
      expect.objectContaining({ is_reversed: false, is_reversal: true }),
    );
    expect(payment3).toEqual(
      expect.objectContaining({ is_reversed: false, is_reversal: false }),
    );
  });

  it("defaults balance to null and installments/payments to empty arrays when absent", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_balances: [{ data: null, error: null }],
      loan_installment_state: [{ data: null, error: null }],
      loan_payments: [{ data: null, error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/loans/10"),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.balance).toBeNull();
    expect(body.data.installments).toEqual([]);
    expect(body.data.payments).toEqual([]);
  });
});
