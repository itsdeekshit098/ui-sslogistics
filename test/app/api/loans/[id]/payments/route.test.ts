import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/loans/[id]/payments/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const LOAN_ROW = { id: 10, status: "ACTIVE" };
const URL = "http://localhost/api/loans/10/payments";

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("POST /api/loans/[id]/payments", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { amount: 100 }),
      paramsFor("10"),
    );

    expect(res.status).toBe(403);
  });

  it("400s when the loan ID is not a number", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/loans/abc/payments", "POST", { amount: 100 }),
      paramsFor("abc"),
    );

    expect(res.status).toBe(400);
  });

  it("surfaces a 500 when the loan lookup errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: null, error: { message: "connection reset" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST", { amount: 100 }), paramsFor("10"));

    expect(res.status).toBe(500);
  });

  it("404s when the loan doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: null, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST", { amount: 100 }), paramsFor("10"));

    expect(res.status).toBe(404);
  });

  it("400s on an unknown payment type", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: LOAN_ROW, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { payment_type: "BRIBE", amount: 100 }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid payment type/);
  });

  it("400s on a non-positive amount", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: LOAN_ROW, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { payment_type: "CHARGE", amount: 0 }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Amount must be greater than zero");
  });

  it("400s on an invalid payment date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: LOAN_ROW, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", {
        payment_type: "CHARGE",
        amount: 100,
        paid_on: "2026-02-31",
      }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid payment date");
  });

  it("400s when an EMI payment doesn't say which installment it settles", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ loans: [{ data: LOAN_ROW, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { payment_type: "EMI", amount: 100 }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/must say which installment/);
  });

  it("surfaces a 500 when the installment lookup errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_installment_state: [{ data: null, error: { message: "boom" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { payment_type: "EMI", amount: 100, installment_id: 5 }),
      paramsFor("10"),
    );

    expect(res.status).toBe(500);
  });

  it("404s when the installment doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_installment_state: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { payment_type: "EMI", amount: 100, installment_id: 5 }),
      paramsFor("10"),
    );

    expect(res.status).toBe(404);
  });

  it("400s when the installment belongs to a different loan", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_installment_state: [
        {
          data: { id: 5, loan_id: 99, amount_remaining: 5000, status: "PENDING" },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { payment_type: "EMI", amount: 100, installment_id: 5 }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/different loan/);
  });

  it("409s when the installment is already fully paid", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_installment_state: [
        {
          data: { id: 5, loan_id: 10, amount_remaining: 0, status: "PAID" },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { payment_type: "EMI", amount: 100, installment_id: 5 }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already fully paid/);
  });

  it("409s when the installment was waived", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_installment_state: [
        {
          data: { id: 5, loan_id: 10, amount_remaining: 5000, status: "WAIVED" },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { payment_type: "EMI", amount: 100, installment_id: 5 }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/waived/);
  });

  it("400s when the amount exceeds what's remaining on the installment", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_installment_state: [
        {
          data: { id: 5, loan_id: 10, amount_remaining: 100, status: "PENDING" },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { payment_type: "EMI", amount: 500, installment_id: 5 }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Record the extra as a prepayment/);
  });

  it("records an EMI payment and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_installment_state: [
        {
          data: { id: 5, loan_id: 10, amount_remaining: 5000, status: "PENDING" },
          error: null,
        },
      ],
      loan_payments: [
        {
          data: { id: 77, loan_id: 10, installment_id: 5, amount: 5000 },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", {
        payment_type: "EMI",
        amount: 5000,
        installment_id: 5,
        paid_on: "2026-03-05",
        payment_method: "UPI",
        reference: " ref-1 ",
        notes: " settled in full ",
      }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.payment.id).toBe(77);
    expect(supa.callCount("loan_payments")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE_LOAN_PAYMENT",
        recordId: 77,
        tableName: "loan_payments",
        details: expect.objectContaining({
          loan_id: 10,
          payment_type: "EMI",
          amount: 5000,
          paid_on: "2026-03-05",
        }),
      }),
    );
  });

  it("defaults paid_on to today when omitted", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_payments: [{ data: { id: 1, loan_id: 10 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { payment_type: "CHARGE", amount: 250 }),
      paramsFor("10"),
    );

    expect(res.status).toBe(201);
  });

  it("accepts an optional installment_id on a non-EMI payment for context", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_payments: [{ data: { id: 1, loan_id: 10, installment_id: 5 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", {
        payment_type: "PREPAYMENT",
        amount: 1000,
        installment_id: 5,
      }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.payment.installment_id).toBe(5);
    // Only the payment insert hit loan_installment_state's sibling table -
    // context installment_id is not validated against the DB for non-EMI types.
    expect(supa.callCount("loan_installment_state")).toBe(0);
  });

  it("ignores an empty-string installment_id on a non-EMI payment", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_payments: [
        { data: { id: 1, loan_id: 10, installment_id: null }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", {
        payment_type: "PREPAYMENT",
        amount: 1000,
        installment_id: "",
      }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.payment.installment_id).toBeNull();
  });

  it("surfaces a 500 when the payment insert fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: LOAN_ROW, error: null }],
      loan_payments: [{ data: null, error: { message: "constraint violation" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { payment_type: "CHARGE", amount: 250 }),
      paramsFor("10"),
    );

    expect(res.status).toBe(500);
    expect(logActivity).not.toHaveBeenCalled();
  });
});

describe("PUT /api/loans/[id]/payments", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest(URL, "PUT", { installment_id: 5, manual_status: "WAIVED" }),
      paramsFor("10"),
    );

    expect(res.status).toBe(403);
  });

  it("400s when the loan ID is not a number", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest(URL, "PUT", { installment_id: 5 }),
      paramsFor("abc"),
    );

    expect(res.status).toBe(400);
  });

  it("400s when the installment ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest(URL, "PUT", {}), paramsFor("10"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Missing installment ID");
  });

  it("400s on an invalid manual_status", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest(URL, "PUT", { installment_id: 5, manual_status: "ON_VACATION" }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid status/);
  });

  it("surfaces a 500 when the installment lookup errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_installments: [{ data: null, error: { message: "boom" } }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest(URL, "PUT", { installment_id: 5, manual_status: "WAIVED" }),
      paramsFor("10"),
    );

    expect(res.status).toBe(500);
  });

  it("404s when the installment doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_installments: [{ data: null, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest(URL, "PUT", { installment_id: 5, manual_status: "WAIVED" }),
      paramsFor("10"),
    );

    expect(res.status).toBe(404);
  });

  it("400s when the installment belongs to a different loan", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_installments: [{ data: { id: 5, loan_id: 99 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest(URL, "PUT", { installment_id: 5, manual_status: "WAIVED" }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/different loan/);
  });

  it("surfaces a 500 when the update fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_installments: [
        { data: { id: 5, loan_id: 10 }, error: null },
        { data: null, error: { message: "deadlock" } },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest(URL, "PUT", { installment_id: 5, manual_status: "WAIVED" }),
      paramsFor("10"),
    );

    expect(res.status).toBe(500);
  });

  it("flags an installment as WAIVED and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      loan_installments: [
        { data: { id: 5, loan_id: 10 }, error: null },
        { data: { id: 5, loan_id: 10, manual_status: "WAIVED" }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest(URL, "PUT", {
        installment_id: 5,
        manual_status: "WAIVED",
        notes: " lender forgave it ",
      }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.installment.manual_status).toBe("WAIVED");
    expect(supa.callCount("loan_installments")).toBe(2);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE_LOAN_INSTALLMENT",
        recordId: 5,
        details: { loan_id: 10, manual_status: "WAIVED" },
      }),
    );
  });

  it("clears manual_status when explicitly set to an empty string", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_installments: [
        { data: { id: 5, loan_id: 10 }, error: null },
        { data: { id: 5, loan_id: 10, manual_status: null }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest(URL, "PUT", { installment_id: 5, manual_status: "" }),
      paramsFor("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.installment.manual_status).toBeNull();
  });

  it("clears notes when explicitly set to an empty string", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_installments: [
        { data: { id: 5, loan_id: 10 }, error: null },
        { data: { id: 5, loan_id: 10 }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest(URL, "PUT", { installment_id: 5, notes: "   " }),
      paramsFor("10"),
    );

    expect(res.status).toBe(200);
  });
});
