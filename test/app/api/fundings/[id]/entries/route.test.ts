import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/fundings/[id]/entries/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

const FUNDING = { id: 10, start_date: "2026-01-01", status: "OPEN" };

const VALID_ENTRY_BODY = {
  entry_type: "PRINCIPAL_TAKEN",
  amount: 25000,
  entry_date: "2026-01-10",
};

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("POST /api/fundings/[id]/entries", () => {
  it("rejects a non-admin the same way requireStrictAdminAuth does", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", VALID_ENTRY_BODY),
      params("10"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric funding id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/abc/entries", "POST", VALID_ENTRY_BODY),
      params("abc"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid funding ID");
  });

  it("404s when the funding doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", VALID_ENTRY_BODY),
      params("10"),
    );

    expect(res.status).toBe(404);
  });

  it("surfaces a 500 when the funding lookup errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: null, error: { message: "connection reset" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", VALID_ENTRY_BODY),
      params("10"),
    );

    expect(res.status).toBe(500);
  });

  it("400s on an invalid entry_type", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: FUNDING, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", {
        ...VALID_ENTRY_BODY,
        entry_type: "BONUS",
      }),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid entry type/);
  });

  it("400s on a non-positive amount", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: FUNDING, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", {
        ...VALID_ENTRY_BODY,
        amount: 0,
      }),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Amount must be greater than zero");
  });

  it("400s on an invalid entry_date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: FUNDING, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", {
        ...VALID_ENTRY_BODY,
        entry_date: "not-a-date",
      }),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid entry date");
  });

  it("400s when the entry date is before the funding start date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: FUNDING, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", {
        ...VALID_ENTRY_BODY,
        entry_date: "2025-12-31",
      }),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Entry date cannot be before the funding start date");
  });

  it("400s when a PRINCIPAL_REPAID amount exceeds the outstanding principal", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: FUNDING, error: null }],
      funding_balances: [{ data: { principal_outstanding: 10000 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", {
        entry_type: "PRINCIPAL_REPAID",
        amount: 20000,
        entry_date: "2026-01-10",
      }),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/more than the/);
  });

  it("400s when an ADJUSTMENT amount exceeds the outstanding principal, with no balance row found", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: FUNDING, error: null }],
      funding_balances: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", {
        entry_type: "ADJUSTMENT",
        amount: 1,
        entry_date: "2026-01-10",
      }),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/more than the/);
  });

  it("allows a PRINCIPAL_REPAID within the outstanding balance", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: FUNDING, error: null }],
      funding_balances: [{ data: { principal_outstanding: 10000 }, error: null }],
      funding_entries: [
        {
          data: { id: 99, funding_id: 10, entry_type: "PRINCIPAL_REPAID", amount: 5000 },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", {
        entry_type: "PRINCIPAL_REPAID",
        amount: 5000,
        entry_date: "2026-01-10",
      }),
      params("10"),
    );

    expect(res.status).toBe(201);
  });

  it("records a PRINCIPAL_TAKEN entry (no balance check) and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: FUNDING, error: null }],
      funding_entries: [
        {
          data: {
            id: 55,
            funding_id: 10,
            entry_type: "PRINCIPAL_TAKEN",
            amount: 25000,
            entry_date: "2026-01-10",
          },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", {
        ...VALID_ENTRY_BODY,
        payment_method: "CASH",
        reference: "REF-1",
        description: "Extra principal drawn",
      }),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.entry.id).toBe(55);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE_FUNDING_ENTRY",
        recordId: 55,
        details: expect.objectContaining({ funding_id: 10, entry_type: "PRINCIPAL_TAKEN" }),
      }),
    );
  });

  it("defaults entry_date to today when not supplied", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: { id: 10, start_date: "2000-01-01", status: "OPEN" }, error: null }],
      funding_entries: [
        { data: { id: 56, funding_id: 10, entry_type: "INTEREST_PAID", amount: 100 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", {
        entry_type: "INTEREST_PAID",
        amount: 100,
      }),
      params("10"),
    );

    expect(res.status).toBe(201);
  });

  it("surfaces a 500 when the insert errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: FUNDING, error: null }],
      funding_entries: [{ data: null, error: { message: "constraint violation" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries", "POST", VALID_ENTRY_BODY),
      params("10"),
    );

    expect(res.status).toBe(500);
    expect(logActivity).not.toHaveBeenCalled();
  });
});
