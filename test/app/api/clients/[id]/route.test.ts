import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/clients/[id]/route");
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
});

describe("GET /api/clients/[id]", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1"), params("1"));

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric client id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/abc"), params("abc"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid client ID");
  });

  it("surfaces a 500 when the client fetch errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1"), params("1"));

    expect(res.status).toBe(500);
  });

  it("404s when the client doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: null, error: null }] });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1"), params("1"));

    expect(res.status).toBe(404);
  });

  it("surfaces a 500 when the contacts query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_balances: [{ data: { outstanding: 500 }, error: null }],
      client_contacts: [{ data: null, error: { message: "connection reset" } }],
      client_deployments: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1"), params("1"));

    expect(res.status).toBe(500);
  });

  it("surfaces a 500 when the deployments query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_balances: [{ data: { outstanding: 500 }, error: null }],
      client_contacts: [{ data: [], error: null }],
      client_deployments: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1"), params("1"));

    expect(res.status).toBe(500);
  });

  it("returns the client profile with balance, contacts and an active-only fleet mix", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_balances: [{ data: { outstanding: 500 }, error: null }],
      client_contacts: [
        { data: [{ id: 5, name: "Jane", is_primary: true }], error: null },
      ],
      client_deployments: [
        {
          data: [
            { id: 10, is_active: true, vehicle_type: "BUS", quantity: 2 },
            { id: 11, is_active: true, vehicle_type: "BUS", quantity: 1 },
            { id: 12, is_active: false, vehicle_type: "TRUCK", quantity: 5 },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1"), params("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.client.id).toBe(1);
    expect(body.data.balance).toEqual({ outstanding: 500 });
    expect(body.data.contacts).toHaveLength(1);
    expect(body.data.deployments).toHaveLength(3);
    // Inactive TRUCK deployment is excluded from the fleet mix.
    expect(body.data.fleet_mix).toEqual({ BUS: 3 });
  });

  it("returns null balance and empty lists when none exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_balances: [{ data: null, error: null }],
      client_contacts: [{ data: null, error: null }],
      client_deployments: [{ data: null, error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1"), params("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.balance).toBeNull();
    expect(body.data.contacts).toEqual([]);
    expect(body.data.deployments).toEqual([]);
    expect(body.data.fleet_mix).toEqual({});
  });
});
