import { describe, it, expect, beforeEach, vi } from "vitest";
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
      clients: [{ data: [{ id: 2 }], error: null, count: 1 }],
      client_balances: [
        { data: [{ client_id: 2 }], error: null }, // who owes
        { data: [{ client_id: 2, outstanding: 300 }], error: null }, // this page
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
    mockSupabaseAdmin({ clients: [{ data: [], error: null }] }); // the duplicate-name lookup
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

  it("refuses the whole create, saving nothing, when the opening balance is not a valid amount", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      clients: [{ data: { id: 42, name: "Acme", client_type: "VENDOR" }, error: null }],
    });
    const { POST } = await importRoute();

    for (const bad of [-5, 100.555, 1e20]) {
      const res = await POST(
        jsonRequest("http://localhost/api/clients", "POST", { name: "Acme", opening_balance: bad }),
      );
      expect(res.status).toBe(400);
    }
    expect(supa.callCount("client_ledger_entries")).toBe(0);
  });

  it("refuses the whole create when the opening date is invalid or in the future", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 42, name: "Acme", client_type: "VENDOR" }, error: null }],
    });
    const { POST } = await importRoute();

    for (const date of ["not-a-date", "2999-01-01"]) {
      const res = await POST(
        jsonRequest("http://localhost/api/clients", "POST", {
          name: "Acme",
          opening_balance: 1000,
          opening_date: date,
        }),
      );
      expect(res.status).toBe(400);
    }
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
      clients: [
        { data: [], error: null }, // the name looks free (a case-variant raced in)
        { data: null, error: { code: "23505" } }, // the unique constraint catches it
      ],
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
        { data: [], error: null }, // no other client already has that name
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
    expect(supa.callCount("clients")).toBe(3);
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
        { data: [], error: null }, // name lookup
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

  it("names the contacts and vehicle assignments that block a delete, and deletes nothing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_balances: [{ data: null, error: null }],
      client_contacts: [{ data: null, error: null, count: 2 }],
      client_deployments: [{ data: null, error: null, count: 1 }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/clients?id=1"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/2 contacts and 1 vehicle assignment/);
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("deletes the client and logs the audit entry when nothing blocks it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }, { error: null }],
      client_balances: [{ data: null, error: null }],
      client_contacts: [{ data: null, error: null, count: 0 }],
      client_deployments: [{ data: null, error: null, count: 0 }],
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
      client_contacts: [{ data: null, error: null, count: 0 }],
      client_deployments: [{ data: null, error: null, count: 0 }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/clients?id=1"));

    expect(res.status).toBe(500);
  });
});

/** The query builder handed out for the first `.from(table)` call. */
function firstBuilder(supa: { from: { mock: { calls: unknown[][]; results: { value: unknown }[] } } }, table: string) {
  const index = supa.from.mock.calls.findIndex((call) => call[0] === table);
  return supa.from.mock.results[index].value as Record<string, { mock: unknown }> & {
    in: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
  };
}

describe("GET /api/clients: the 'owes money' filter", () => {
  const get = async (clients: unknown[], owing: number[], query = "") => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      clients: [{ data: clients, error: null, count: owing.length }],
      client_balances: [
        { data: owing.map((client_id) => ({ client_id })), error: null },
        { data: owing.map((client_id) => ({ client_id, outstanding: 50 })), error: null },
      ],
      client_deployments: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();
    const res = await GET(new NextRequest(`http://localhost/api/clients?has_dues=true${query}`));
    return { body: (await res.json()).data, supa };
  };

  it("asks the database for the clients that owe and counts only them", async () => {
    const { body, supa } = await get([{ id: 2 }, { id: 4 }, { id: 5 }], [2, 4, 5]);
    expect(body.total).toBe(3);
    expect(body.data.map((c: { id: number }) => c.id)).toEqual([2, 4, 5]);
    // The page is cut in the database, so a row cap can't drop clients first.
    const builder = firstBuilder(supa, "clients");
    expect(builder.range).toHaveBeenCalled();
    expect(builder.in).toHaveBeenCalledWith("id", [2, 4, 5]);
  });

  it("returns an empty list, not everyone, when nobody owes", async () => {
    const { body, supa } = await get([], []);
    expect(body.total).toBe(0);
    expect(body.data).toEqual([]);
    expect(firstBuilder(supa, "clients").in).toHaveBeenCalledWith("id", [0]);
  });
});

describe("clients route: failed lookups and individual names", () => {
  const send = (method: string, body: unknown) =>
    new NextRequest("http://localhost/api/clients", { method, body: JSON.stringify(body) });

  beforeEach(() => requireStrictAdminAuth.mockResolvedValue(ADMIN_USER));

  it("answers 500, not 'name is free', when the duplicate-name lookup fails", async () => {
    const supa = mockSupabaseAdmin({
      lookup_options: [{ data: { value: "VENDOR" }, error: null }],
      clients: [{ data: null, error: { message: "timeout" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(send("POST", { name: "Acme", client_type: "VENDOR" }));

    expect(res.status).toBe(500);
    expect(supa.callCount("clients")).toBe(1); // no insert was attempted
  });

  it("refuses a different name for an individual, but accepts their own", async () => {
    mockSupabaseAdmin({
      clients: [
        { data: { party_kind: "INDIVIDUAL", name: "Ravi" }, error: null },
        { data: { id: 1, name: "Ravi" }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(send("PUT", { id: 1, name: "Someone Else" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Rename the entity/);

    mockSupabaseAdmin({
      clients: [
        { data: { party_kind: "INDIVIDUAL", name: "Ravi" }, error: null },
        { data: { id: 1, name: "Ravi" }, error: null },
      ],
    });
    const { PUT: PUT2 } = await importRoute();
    const same = await PUT2(send("PUT", { id: 1, name: "Ravi", notes: "x" }));
    expect(same.status).toBe(200);
  });
});

describe("bad input to /api/clients that used to be a 500 or be stored as junk", () => {
  const send = (method: string, body: unknown, raw?: string) =>
    new NextRequest("http://localhost/api/clients", { method, body: raw ?? JSON.stringify(body) });

  beforeEach(() => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
  });

  it.each([["malformed JSON", "{bad"], ["null", "null"], ["an array", "[]"], ["an empty body", ""]])(
    "POST and PUT answer 400 for %s",
    async (_label, raw) => {
      const { POST, PUT } = await importRoute();
      expect((await POST(send("POST", undefined, raw))).status).toBe(400);
      expect((await PUT(send("PUT", undefined, raw))).status).toBe(400);
    },
  );

  it.each([1.5, "1.5", "", "abc", 0, -2])("PUT refuses %j as the client id", async (id) => {
    const { PUT } = await importRoute();
    expect((await PUT(send("PUT", { id, notes: "x" }))).status).toBe(400);
  });

  it.each(["1.5", "abc", "0"])("DELETE refuses id=%s", async (id) => {
    const { DELETE } = await importRoute();
    const res = await DELETE(new NextRequest(`http://localhost/api/clients?id=${id}`, { method: "DELETE" }));
    expect(res.status).toBe(400);
  });

  it.each([
    ["location", "x".repeat(151), /150 characters/],
    ["address", "x".repeat(501), /500 characters/],
    ["gst_number", "x".repeat(21), /20 characters/],
    ["location", { a: 1 }, /must be text/],
    ["address", ["x"], /must be text/],
    ["gst_number", { a: 1 }, /must be text/],
    ["notes", { a: 1 }, /must be text/],
  ])("refuses %s = %j", async (field, value, message) => {
    mockSupabaseAdmin({ clients: [{ data: [], error: null }] });
    const { POST } = await importRoute();
    const res = await POST(send("POST", { name: "Acme", [field]: value }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(message);
  });

  it.each(["false", "true", 0, 1, null, {}])("refuses is_active = %j (only true or false)", async (flag) => {
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, party_kind: "COMPANY" }, error: null }],
    });
    const { PUT } = await importRoute();
    const res = await PUT(send("PUT", { id: 1, is_active: flag }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("is_active must be true or false");
  });

  it("refuses a client type that is not in the type list", async () => {
    mockSupabaseAdmin({
      clients: [{ data: [], error: null }],
      lookup_options: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();
    const res = await POST(send("POST", { name: "Acme", client_type: "BOGUS" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Unknown client type");
  });

  it("refuses a client type that is not text", async () => {
    mockSupabaseAdmin({ clients: [{ data: [], error: null }] });
    const { POST } = await importRoute();
    const res = await POST(send("POST", { name: "Acme", client_type: { a: 1 } }));
    expect(res.status).toBe(400);
  });

  it("refuses a name that differs from another client's only by case", async () => {
    mockSupabaseAdmin({ clients: [{ data: [{ id: 9 }], error: null }] });
    const { POST } = await importRoute();
    const res = await POST(send("POST", { name: "ACT" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("A client with that name already exists");
  });

  it("says which rule was broken when an entity already has a client account", async () => {
    mockSupabaseAdmin({
      clients: [{ data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "uq_clients_entity"' } }],
      entities: [{ data: { id: 5 }, error: null }],
    });
    const { POST } = await importRoute();
    const res = await POST(send("POST", { party_kind: "INDIVIDUAL", entity_id: 5 }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("That person or firm already has a client account");
  });

  it("ignores a name sent for an individual: it comes from the linked entity", async () => {
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, party_kind: "INDIVIDUAL" }, error: null }],
    });
    const { PUT } = await importRoute();
    const res = await PUT(send("PUT", { id: 1, name: "Renamed" }));
    // nothing else to change, so nothing is written
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("No fields to update");
  });
});

