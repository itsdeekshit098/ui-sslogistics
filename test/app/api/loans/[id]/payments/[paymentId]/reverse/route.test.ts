import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/loans/[id]/payments/[paymentId]/reverse/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function paramsFor(id: string, paymentId: string) {
  return { params: Promise.resolve({ id, paymentId }) };
}

const URL = "http://localhost/api/loans/10/payments/50/reverse";
const ORIGINAL_PAYMENT = {
  id: 50,
  loan_id: 10,
  installment_id: 5,
  payment_type: "EMI",
  amount: 5000,
  reverses_payment_id: null,
};

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("POST /api/loans/[id]/payments/[paymentId]/reverse", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST"), paramsFor("10", "50"));

    expect(res.status).toBe(403);
  });

  it("400s when the loan or payment ID is not a number", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST"), paramsFor("abc", "50"));

    expect(res.status).toBe(400);
  });

  it("400s when the payment ID is not a number", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST"), paramsFor("10", "xyz"));

    expect(res.status).toBe(400);
  });

  it("treats a missing body as no reason, without erroring", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_payments: [
        { data: ORIGINAL_PAYMENT, error: null },
        { data: null, error: null },
        { data: { id: 99, reverses_payment_id: 50, notes: "Reversal of #50" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(new NextRequest(URL, { method: "POST" }), paramsFor("10", "50"));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.payment.notes).toBe("Reversal of #50");
  });

  it("treats malformed JSON in the body as no reason, without erroring", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_payments: [
        { data: ORIGINAL_PAYMENT, error: null },
        { data: null, error: null },
        { data: { id: 99, reverses_payment_id: 50 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      new NextRequest(URL, { method: "POST", body: "not-json" }),
      paramsFor("10", "50"),
    );

    expect(res.status).toBe(201);
  });

  it("surfaces a 500 when the original payment lookup errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_payments: [{ data: null, error: { message: "boom" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST"), paramsFor("10", "50"));

    expect(res.status).toBe(500);
  });

  it("404s when the payment doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_payments: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST"), paramsFor("10", "50"));

    expect(res.status).toBe(404);
  });

  it("400s when the payment belongs to a different loan", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_payments: [{ data: { ...ORIGINAL_PAYMENT, loan_id: 99 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST"), paramsFor("10", "50"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/different loan/);
  });

  it("400s when trying to reverse a reversal", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_payments: [
        { data: { ...ORIGINAL_PAYMENT, reverses_payment_id: 1 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST"), paramsFor("10", "50"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("A reversal cannot itself be reversed");
  });

  it("409s when the payment has already been reversed", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_payments: [
        { data: ORIGINAL_PAYMENT, error: null },
        { data: { id: 88 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST"), paramsFor("10", "50"));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("This payment has already been reversed");
  });

  it("409s when a concurrent reversal wins the race (unique index violation)", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_payments: [
        { data: ORIGINAL_PAYMENT, error: null },
        { data: null, error: null },
        { data: null, error: { code: "23505", message: "duplicate key" } },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST"), paramsFor("10", "50"));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("This payment has already been reversed");
  });

  it("surfaces a 500 for a non-conflict insert error", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_payments: [
        { data: ORIGINAL_PAYMENT, error: null },
        { data: null, error: null },
        { data: null, error: { code: "23503", message: "fk violation" } },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest(URL, "POST"), paramsFor("10", "50"));

    expect(res.status).toBe(500);
  });

  it("reverses the payment, includes the reason in the notes, and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      loan_payments: [
        { data: ORIGINAL_PAYMENT, error: null },
        { data: null, error: null },
        {
          data: {
            id: 99,
            loan_id: 10,
            reverses_payment_id: 50,
            amount: 5000,
            notes: "Reversal of #50: entered by mistake",
          },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest(URL, "POST", { reason: " entered by mistake " }),
      paramsFor("10", "50"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.payment.id).toBe(99);
    expect(body.data.payment.notes).toBe("Reversal of #50: entered by mistake");
    expect(supa.callCount("loan_payments")).toBe(3);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "REVERSE_LOAN_PAYMENT",
        recordId: 99,
        details: {
          loan_id: 10,
          reversed_payment_id: 50,
          reason: "entered by mistake",
        },
      }),
    );
  });

  it("truncates an overlong reason to 200 characters", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loan_payments: [
        { data: ORIGINAL_PAYMENT, error: null },
        { data: null, error: null },
        { data: { id: 99, loan_id: 10 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const longReason = "x".repeat(300);
    const res = await POST(
      jsonRequest(URL, "POST", { reason: longReason }),
      paramsFor("10", "50"),
    );

    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ reason: "x".repeat(200) }),
      }),
    );
  });
});
