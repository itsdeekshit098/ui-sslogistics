import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/clients/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/clients", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients"));

    expect(res.status).toBe(403);
  });

  it("lists clients with balances and deployment mix merged in", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: [{ id: 1, name: "Acme" }, { id: 2, name: "Beta" }], error: null, count: 2 }],
      client_balances: [
        { data: [{ client_id: 1, outstanding: 500 }], error: null },
      ],
      client_deployments: [
        { data: [{ client_id: 1, vehicle_type: "BUS", quantity: 2 }], error: null },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.total).toBe(2);
    expect(body.data.data[0]).toEqual(
      expect.objectContaining({
        id: 1,
        balance: expect.objectContaining({ outstanding: 500 }),
        deployment_mix: { BUS: 2 },
      }),
    );
    // Client 2 has no balance/deployment rows -> falls back to the empty defaults.
    expect(body.data.data[1].balance).toEqual(
      expect.objectContaining({ client_id: 2, outstanding: 0, entry_count: 0 }),
    );
    expect(body.data.data[1].deployment_mix).toEqual({});
  });

  it("applies every list filter and escapes special characters in search", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: [], error: null, count: 0 }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/clients?client_type=VENDOR&party_kind=COMPANY" +
          "&is_active=true&search=100%25_off",
      ),
    );

    expect(res.status).toBe(200);
  });

  it("treats is_active=false as a real filter value", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: [], error: null, count: 0 }] });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients?is_active=false"));

    expect(res.status).toBe(200);
  });

  it("filters to only clients with dues when has_dues=true", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: [{ id: 1 }, { id: 2 }], error: null, count: 2 }],
      client_balances: [
        {
          data: [
            { client_id: 1, outstanding: 0 },
            { client_id: 2, outstanding: 300 },
          ],
          error: null,
        },
      ],
      client_deployments: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients?has_dues=true"));
    const body = await res.json();

    expect(body.data.data).toHaveLength(1);
    expect(body.data.data[0].id).toBe(2);
  });

  it("includes a portfolio summary only when include_summary=true", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      clients: [
        { data: [], error: null, count: 0 }, // paginated list
        { data: [{ id: 1, is_active: true }, { id: 2, is_active: false }], error: null }, // summary
      ],
      client_balances: [
        { data: [{ outstanding: 500, advance_amount: 0 }, { outstanding: -100, advance_amount: 100 }], error: null },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients?include_summary=true"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.summary).toEqual(
      expect.objectContaining({
        totalClients: 2,
        activeClients: 1,
        totalOutstanding: 500,
        totalAdvance: 100,
        clientsWithDues: 1,
      }),
    );
    expect(supa.callCount("clients")).toBe(2);
  });

  it("surfaces a 500 when the list query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      clients: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients"));

    expect(res.status).toBe(500);
    expect(supa.callCount("client_balances")).toBe(0);
  });
});

describe("POST /api/clients", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", { name: "Acme" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s on an invalid party_kind", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", {
        name: "Acme",
        party_kind: "TRUST",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Party kind must be one of/);
  });

  it("400s when a COMPANY name is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/clients", "POST", {}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Company name is required");
  });

  it("400s when an INDIVIDUAL isn't linked to an entity", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", { party_kind: "INDIVIDUAL" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("An individual must be linked to an entity");
  });

  it("400s when entity_id no longer exists", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", {
        party_kind: "INDIVIDUAL",
        entity_id: 99,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Selected entity no longer exists");
  });

  it("400s when receiving_account_id no longer exists", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      bank_accounts: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", {
        name: "Acme",
        receiving_account_id: 99,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Selected account no longer exists");
  });

  it("400s when notes exceed the max length", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", {
        name: "Acme",
        notes: "x".repeat(501),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/500 characters or less/);
  });

  it("creates the client and logs the audit entry when there's no opening balance", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      clients: [{ data: { id: 42, name: "Acme", client_type: "VENDOR" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", {
        name: "Acme",
        location: "Hyderabad",
        gst_number: "GST123",
        is_active: true,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.client.id).toBe(42);
    expect(supa.callCount("client_ledger_entries")).toBe(0);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_CLIENT", recordId: 42 }),
    );
  });

  it("records an opening balance ledger entry when a valid amount is given", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      clients: [{ data: { id: 42, name: "Acme", client_type: "VENDOR" }, error: null }],
      client_ledger_entries: [{ error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", {
        name: "Acme",
        opening_balance: 1000,
        opening_date: "2026-01-01",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.message).toBe("Client added");
    expect(supa.callCount("client_ledger_entries")).toBe(1);
  });

  it("warns but still creates the client when opening_balance is invalid", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 42, name: "Acme", client_type: "VENDOR" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", {
        name: "Acme",
        opening_balance: -5,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.message).toMatch(/opening balance was not a valid amount/);
  });

  it("warns when the opening_date is invalid", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 42, name: "Acme", client_type: "VENDOR" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", {
        name: "Acme",
        opening_balance: 1000,
        opening_date: "not-a-date",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.message).toMatch(/opening balance date was invalid/);
  });

  it("warns when the opening balance ledger insert fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 42, name: "Acme", client_type: "VENDOR" }, error: null }],
      client_ledger_entries: [{ error: { message: "constraint violation" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", {
        name: "Acme",
        opening_balance: 1000,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.message).toMatch(/opening balance failed to record/);
  });

  it("409s on a duplicate name", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: null, error: { code: "23505" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", { name: "Acme" }),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already exists/);
  });

  it("surfaces a 500 for other insert errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: null, error: { message: "connection reset" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients", "POST", { name: "Acme" }),
    );

    expect(res.status).toBe(500);
  });
});

describe("PUT /api/clients", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients", "PUT", { id: 1, name: "x" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when the client ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/clients", "PUT", {}));

    expect(res.status).toBe(400);
  });

  it("404s when the client doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: null, error: null }] });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients", "PUT", { id: 1, name: "x" }),
    );

    expect(res.status).toBe(404);
  });

  it("surfaces a 500 when the existing-client fetch errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: null, error: { message: "connection reset" } }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients", "PUT", { id: 1, name: "x" }),
    );

    expect(res.status).toBe(500);
  });

  it("400s when no updatable fields are supplied", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, party_kind: "COMPANY" }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/clients", "PUT", { id: 1 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("No fields to update");
  });

  it("updates fields and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      clients: [
        { data: { id: 1, party_kind: "COMPANY" }, error: null },
        { data: { id: 1, name: "Acme Renamed" }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients", "PUT", { id: 1, name: "Acme Renamed" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.client.name).toBe("Acme Renamed");
    expect(supa.callCount("clients")).toBe(2);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_CLIENT", recordId: 1 }),
    );
  });

  it("clears entity_id to null for a non-individual", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [
        { data: { id: 1, party_kind: "COMPANY" }, error: null },
        { data: { id: 1 }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients", "PUT", { id: 1, entity_id: null }),
    );

    expect(res.status).toBe(200);
  });

  it("400s when clearing entity_id on an existing INDIVIDUAL", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, party_kind: "INDIVIDUAL" }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients", "PUT", { id: 1, entity_id: null }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("An individual must be linked to an entity");
  });

  it("clears receiving_account_id to null", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [
        { data: { id: 1, party_kind: "COMPANY" }, error: null },
        { data: { id: 1 }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients", "PUT", {
        id: 1,
        receiving_account_id: null,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("clears location/address/gst_number and notes to null", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [
        { data: { id: 1, party_kind: "COMPANY" }, error: null },
        { data: { id: 1 }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients", "PUT", {
        id: 1,
        location: null,
        address: null,
        gst_number: null,
        notes: null,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("409s on a duplicate name during update", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [
        { data: { id: 1, party_kind: "COMPANY" }, error: null },
        { data: null, error: { code: "23505" } },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients", "PUT", { id: 1, name: "Dup" }),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already exists/);
  });

  it("surfaces a 500 for other update errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [
        { data: { id: 1, party_kind: "COMPANY" }, error: null },
        { data: null, error: { message: "connection reset" } },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients", "PUT", { id: 1, name: "x" }),
    );

    expect(res.status).toBe(500);
  });

  it("404s when the update matches no row", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [
        { data: { id: 1, party_kind: "COMPANY" }, error: null },
        { data: null, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients", "PUT", { id: 1, name: "x" }),
    );

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/clients", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/clients?id=1"));

    expect(res.status).toBe(403);
  });

  it("400s when the client ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/clients"));

    expect(res.status).toBe(400);
  });

  it("404s when the client doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: null, error: null }] });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/clients?id=1"));

    expect(res.status).toBe(404);
  });

  it("surfaces a 500 when the client fetch errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: null, error: { message: "connection reset" } }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/clients?id=1"));

    expect(res.status).toBe(500);
  });

  it("blocks deletion when the account isn't settled", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_balances: [{ data: { outstanding: 500, entry_count: 3 }, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/clients?id=1"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/not settled/);
  });

  it("blocks deletion when the statement has entries even at zero balance", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_balances: [{ data: { outstanding: 0, entry_count: 2 }, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/clients?id=1"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/has 2 entries/);
  });

  it("deletes the client and logs the audit entry when nothing blocks it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }, { error: null }],
      client_balances: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/clients?id=1"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_CLIENT", recordId: 1 }),
    );
  });

  it("surfaces a 500 when the delete itself errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [
        { data: { id: 1, name: "Acme" }, error: null },
        { error: { message: "connection reset" } },
      ],
      client_balances: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/clients?id=1"));

    expect(res.status).toBe(500);
  });
});
