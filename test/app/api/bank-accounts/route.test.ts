import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/bank-accounts/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const VALID_BODY = {
  holder_entity_id: 1,
  bank_name: "SBI",
  account_number: "1234567890",
  ifsc: "SBIN0001234",
};

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/bank-accounts", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/bank-accounts"));

    expect(res.status).toBe(403);
  });

  it("lists accounts without counts by default", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [{ data: [{ id: 1, bank_name: "SBI" }], error: null, count: 1 }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/bank-accounts"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.data[0]).not.toHaveProperty("loan_count");
  });

  it("includes loan_count per account when with_counts=true", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [{ data: [{ id: 1, bank_name: "SBI" }], error: null, count: 1 }],
      loans: [{ data: [{ debit_account_id: 1 }, { debit_account_id: 1 }], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/bank-accounts?with_counts=true"),
    );
    const body = await res.json();

    expect(body.data.data[0].loan_count).toBe(2);
  });

  it("returns loan_count=0 for an account with no linked loans, when with_counts=true", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [{ data: [{ id: 1, bank_name: "SBI" }], error: null, count: 1 }],
      loans: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/bank-accounts?with_counts=true"),
    );
    const body = await res.json();

    expect(body.data.data[0].loan_count).toBe(0);
  });

  it("skips the loan-count query entirely when the result set is empty", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      bank_accounts: [{ data: [], error: null, count: 0 }],
    });
    const { GET } = await importRoute();

    await GET(new NextRequest("http://localhost/api/bank-accounts?with_counts=true"));

    expect(supa.callCount("loans")).toBe(0);
  });

  it("surfaces a 500 when the list query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [{ data: null, error: { message: "timeout" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/bank-accounts"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/bank-accounts", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/bank-accounts", "POST", VALID_BODY),
    );

    expect(res.status).toBe(403);
  });

  it("400s when holder_entity_id does not resolve to an existing entity", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/bank-accounts", "POST", VALID_BODY),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/no longer exists/);
  });

  it("400s on a missing bank_name", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/bank-accounts", "POST", { ...VALID_BODY, bank_name: "" }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid account number", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/bank-accounts", "POST", {
        ...VALID_BODY,
        account_number: "123",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid IFSC code", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/bank-accounts", "POST", { ...VALID_BODY, ifsc: "garbage" }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid account_type", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/bank-accounts", "POST", {
        ...VALID_BODY,
        account_type: "CHECKING",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when notes exceed the max length", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/bank-accounts", "POST", {
        ...VALID_BODY,
        notes: "x".repeat(501),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("creates the account, defaults account_type to SAVINGS, and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 1 }, error: null }],
      bank_accounts: [
        { data: { id: 5, bank_name: "SBI", account_number: "1234567890" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/bank-accounts", "POST", VALID_BODY),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.bank_account.id).toBe(5);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_BANK_ACCOUNT" }),
    );
  });

  it("409s when the account number already exists at that bank", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 1 }, error: null }],
      bank_accounts: [{ data: null, error: { code: "23505" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/bank-accounts", "POST", VALID_BODY),
    );

    expect(res.status).toBe(409);
  });
});

describe("PUT /api/bank-accounts", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/bank-accounts", "PUT", { id: 1, bank_name: "New" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/bank-accounts", "PUT", { bank_name: "New" }),
    );

    expect(res.status).toBe(400);
  });

  it("404s when the account does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [{ data: null, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/bank-accounts", "PUT", { id: 1, bank_name: "New" }),
    );

    expect(res.status).toBe(404);
  });

  it("400s when no updatable fields are supplied", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [{ data: { id: 1 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/bank-accounts", "PUT", { id: 1 }));

    expect(res.status).toBe(400);
  });

  it("updates the account and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [
        { data: { id: 1 }, error: null },
        { data: { id: 1, bank_name: "New Bank" }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/bank-accounts", "PUT", { id: 1, bank_name: "New Bank" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.bank_account.bank_name).toBe("New Bank");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_BANK_ACCOUNT", recordId: 1 }),
    );
  });

  it("409s when renaming onto an account number that already exists", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [
        { data: { id: 1 }, error: null },
        { data: null, error: { code: "23505" } },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/bank-accounts", "PUT", {
        id: 1,
        account_number: "9999999999",
      }),
    );

    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/bank-accounts", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/bank-accounts?id=1"));

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/bank-accounts"));

    expect(res.status).toBe(400);
  });

  it("404s when the account does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/bank-accounts?id=1"));

    expect(res.status).toBe(404);
  });

  it("blocks deletion when a loan auto-debits from the account", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [{ data: { id: 1, bank_name: "SBI", account_number: "123" }, error: null }],
      loans: [{ count: 2, error: null }],
      clients: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/bank-accounts?id=1"));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/2 loan\(s\) auto-debit/);
  });

  it("blocks deletion when a client pays into the account", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [{ data: { id: 1, bank_name: "SBI", account_number: "123" }, error: null }],
      loans: [{ count: 0, error: null }],
      clients: [{ count: 3, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/bank-accounts?id=1"));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/3 client\(s\) pay into it/);
  });

  it("deletes the account and logs the audit entry when nothing blocks it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [
        { data: { id: 1, bank_name: "SBI", account_number: "123" }, error: null },
        { error: null },
      ],
      loans: [{ count: 0, error: null }],
      clients: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/bank-accounts?id=1"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_BANK_ACCOUNT", recordId: 1 }),
    );
  });

  it("surfaces a 500 when the final delete fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [
        { data: { id: 1, bank_name: "SBI", account_number: "123" }, error: null },
        { error: { message: "fk violation" } },
      ],
      loans: [{ count: 0, error: null }],
      clients: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/bank-accounts?id=1"));

    expect(res.status).toBe(500);
  });
});
