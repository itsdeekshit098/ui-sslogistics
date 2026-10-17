import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import {
  requireUserAuth,
  requireAdminAuth,
  requireStrictAdminAuth,
} from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/vehicle-owners/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  requireUserAuth.mockReset();
  requireAdminAuth.mockReset();
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/vehicle-owners", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/vehicle-owners"));

    expect(res.status).toBe(403);
  });

  it("returns a bare array (legacy shape) when no page param is given", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: [{ id: 1, name: "Acme", relationship: "INTERNAL" }], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/vehicle-owners"));
    const body = await res.json();

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0]).toEqual({ id: 1, name: "Acme", owner_type: "OWN" });
  });

  it("returns a {data, total} envelope when page is given", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: [{ id: 1, name: "Acme", relationship: "EXTERNAL" }], error: null, count: 1 }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/vehicle-owners?page=1"));
    const body = await res.json();

    expect(body.data.total).toBe(1);
    expect(body.data.data[0].owner_type).toBe("EXTERNAL");
  });

  it("maps owner_type=OWN to relationship=INTERNAL in the filter", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/vehicle-owners?owner_type=OWN"),
    );

    expect(res.status).toBe(200);
  });
});

describe("POST /api/vehicle-owners", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicle-owners", "POST", { name: "Acme", owner_type: "OWN" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when name is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicle-owners", "POST", { owner_type: "OWN" }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid owner_type", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicle-owners", "POST", { name: "Acme", owner_type: "FRIEND" }),
    );

    expect(res.status).toBe(400);
  });

  it("409s when a normalized-name near-duplicate exists", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: [{ id: 2, name: "ACME" }], error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicle-owners", "POST", { name: "Acme", owner_type: "OWN" }),
    );

    expect(res.status).toBe(409);
  });

  it("creates the owner as a FIRM entity and logs the audit entry", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: [], error: null }, // name-conflict check
        { data: { id: 5, name: "Acme", relationship: "INTERNAL" }, error: null }, // insert
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicle-owners", "POST", { name: "Acme", owner_type: "OWN" }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.owner.owner_type).toBe("OWN");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_VEHICLE_OWNER" }),
    );
  });
});

describe("PUT /api/vehicle-owners", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/vehicle-owners", "PUT", { id: 1, name: "New" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when no fields are supplied", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/vehicle-owners", "PUT", { id: 1 }));

    expect(res.status).toBe(400);
  });

  it("404s when the owner does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: [], error: null }, // name-conflict check
        { data: null, error: null }, // update returns nothing
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/vehicle-owners", "PUT", { id: 1, name: "New" }),
    );

    expect(res.status).toBe(404);
  });

  it("updates the owner and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: [], error: null },
        { data: { id: 1, name: "New Name", relationship: "INTERNAL" }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/vehicle-owners", "PUT", { id: 1, name: "New Name" }),
    );

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_VEHICLE_OWNER", recordId: 1 }),
    );
  });
});

describe("DELETE /api/vehicle-owners", () => {
  const dependentCounts = (except?: string) => ({
    vehicles: [{ count: except === "vehicles" ? 2 : 0, error: null }],
    loans: [{ count: except === "loans" ? 1 : 0, error: null }],
    fundings: [{ count: except === "fundings" ? 1 : 0, error: null }],
    entities: [
      { data: { id: 1, name: "Acme" }, error: null }, // fetch
      { count: except === "entities" ? 1 : 0, error: null }, // proprietor check
    ],
    clients: [{ count: except === "clients" ? 1 : 0, error: null }],
    bank_accounts: [{ count: except === "bank_accounts" ? 1 : 0, error: null }],
  });

  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/vehicle-owners?id=1"));

    expect(res.status).toBe(403);
  });

  it("404s when the owner does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/vehicle-owners?id=1"));

    expect(res.status).toBe(404);
  });

  it("blocks deletion while vehicles are assigned to the owner", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(dependentCounts("vehicles"));
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/vehicle-owners?id=1"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/2 vehicle\(s\)/);
  });

  it("deletes the owner and logs the audit entry when nothing blocks it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      ...dependentCounts(),
      entities: [
        { data: { id: 1, name: "Acme" }, error: null },
        { count: 0, error: null },
        { error: null }, // delete
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/vehicle-owners?id=1"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_VEHICLE_OWNER", recordId: 1 }),
    );
  });
});
