import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/clients/[id]/deployments/route");
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

const DECLARED_BUS_BODY = {
  vehicle_type: "BUS",
  quantity: 2,
  seating_capacity: 40,
  monthly_rate: 50000,
  start_date: "2026-01-01",
};

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/clients/[id]/deployments", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1/deployments"), params("1"));

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric client id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/abc/deployments"), params("abc"));

    expect(res.status).toBe(400);
  });

  it("surfaces a 500 when the query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_deployments: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1/deployments"), params("1"));

    expect(res.status).toBe(500);
  });

  it("lists deployments for the client", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_deployments: [{ data: [{ id: 1, vehicle_type: "BUS" }], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1/deployments"), params("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.data).toHaveLength(1);
  });
});

describe("POST /api/clients/[id]/deployments", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", DECLARED_BUS_BODY),
      params("1"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric client id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/abc/deployments", "POST", DECLARED_BUS_BODY),
      params("abc"),
    );

    expect(res.status).toBe(400);
  });

  it("404s when the client doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: null, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", DECLARED_BUS_BODY),
      params("1"),
    );

    expect(res.status).toBe(404);
  });

  it("400s on an invalid vehicle_id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        vehicle_id: "not-a-number",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid vehicle");
  });

  it("400s when the linked vehicle no longer exists", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1 }, error: null }],
      vehicles: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", { vehicle_id: 99 }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Selected vehicle no longer exists");
  });

  it("creates a linked deployment copying the vehicle's spec", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      clients: [{ data: { id: 1 }, error: null }],
      vehicles: [
        {
          data: {
            id: 9,
            vehicle_type: "TRUCK",
            seating_capacity: null,
            truck_type: "HCV",
            container_length: null,
            axle_type: null,
            container_body_type: null,
          },
          error: null,
        },
      ],
      client_deployments: [
        { data: { id: 20, vehicle_id: 9, vehicle_type: "TRUCK", quantity: 1 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        vehicle_id: 9,
        monthly_rate: 30000,
        start_date: "2026-01-01",
        end_date: "2026-06-01",
        notes: "linked truck",
        is_active: true,
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.deployment.id).toBe(20);
    expect(supa.callCount("client_deployments")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_CLIENT_DEPLOYMENT", recordId: 20 }),
    );
  });

  it("409s when the vehicle is already deployed elsewhere", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1 }, error: null }],
      vehicles: [
        {
          data: {
            id: 9,
            vehicle_type: "TRUCK",
            seating_capacity: null,
            truck_type: "HCV",
            container_length: null,
            axle_type: null,
            container_body_type: null,
          },
          error: null,
        },
      ],
      client_deployments: [{ data: null, error: { code: "23505" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", { vehicle_id: 9 }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already deployed/);
  });

  it("surfaces a 500 for other insert errors on a linked deployment", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1 }, error: null }],
      vehicles: [
        {
          data: {
            id: 9,
            vehicle_type: "TRUCK",
            seating_capacity: null,
            truck_type: "HCV",
            container_length: null,
            axle_type: null,
            container_body_type: null,
          },
          error: null,
        },
      ],
      client_deployments: [{ data: null, error: { message: "connection reset" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", { vehicle_id: 9 }),
      params("1"),
    );

    expect(res.status).toBe(500);
  });

  it("400s on a non-positive quantity for a declared deployment", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        ...DECLARED_BUS_BODY,
        quantity: 0,
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/whole number from 1 to 1000/);
  });

  it("400s on an invalid vehicle_type for a declared deployment", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        vehicle_type: "SPACESHIP",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Vehicle type must be one of/);
  });

  it("400s on invalid seating capacity for a passenger type", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        vehicle_type: "BUS",
        seating_capacity: -1,
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Seating capacity/);
  });

  it("400s when a TRUCK is missing its truck_type", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        vehicle_type: "TRUCK",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Choose a truck type");
  });

  it("400s when a CONTAINER is missing its length", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        vehicle_type: "CONTAINER",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Choose a container length");
  });

  it("400s when a CONTAINER is missing its axle type", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        vehicle_type: "CONTAINER",
        container_length: "20_FT",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Choose an axle type");
  });

  it("400s when a CONTAINER is missing its body type", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        vehicle_type: "CONTAINER",
        container_length: "20_FT",
        axle_type: "SINGLE_AXLE",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Choose a container body type");
  });

  it("creates a fully specified declared CONTAINER deployment", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1 }, error: null }],
      client_deployments: [
        { data: { id: 21, vehicle_id: null, vehicle_type: "CONTAINER", quantity: 3 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        vehicle_type: "CONTAINER",
        quantity: 3,
        container_length: "20_FT",
        axle_type: "SINGLE_AXLE",
        container_body_type: "CLOSED",
      }),
      params("1"),
    );

    expect(res.status).toBe(201);
  });

  it("400s on a negative monthly_rate", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        ...DECLARED_BUS_BODY,
        monthly_rate: -5,
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Monthly rate/);
  });

  it("400s on an invalid start_date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        ...DECLARED_BUS_BODY,
        start_date: "not-a-date",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid start date");
  });

  it("400s when end_date is before start_date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        ...DECLARED_BUS_BODY,
        start_date: "2026-06-01",
        end_date: "2026-01-01",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("End date cannot be before the start date");
  });

  it("creates a declared deployment with no monthly_rate/dates/notes", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1 }, error: null }],
      client_deployments: [
        { data: { id: 22, vehicle_id: null, vehicle_type: "CAR", quantity: 1 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", {
        vehicle_type: "CAR",
      }),
      params("1"),
    );

    expect(res.status).toBe(201);
  });
});

describe("PUT /api/clients/[id]/deployments", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/deployments", "PUT", { id: 20, ...DECLARED_BUS_BODY }),
      params("1"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric client id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/abc/deployments", "PUT", { id: 20 }),
      params("abc"),
    );

    expect(res.status).toBe(400);
  });

  it("400s when the deployment ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/deployments", "PUT", {}),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Missing deployment ID");
  });

  it("404s when the deployment doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ client_deployments: [{ data: null, error: null }] });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/deployments", "PUT", {
        id: 20,
        ...DECLARED_BUS_BODY,
      }),
      params("1"),
    );

    expect(res.status).toBe(404);
  });

  it("400s when the deployment belongs to a different client", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_deployments: [{ data: { id: 20, client_id: 2 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/deployments", "PUT", {
        id: 20,
        ...DECLARED_BUS_BODY,
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/different client/);
  });

  it("400s on a validation error during update", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_deployments: [{ data: { id: 20, client_id: 1 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/deployments", "PUT", {
        id: 20,
        vehicle_type: "SPACESHIP",
      }),
      params("1"),
    );

    expect(res.status).toBe(400);
  });

  it("updates the deployment and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      client_deployments: [
        { data: { id: 20, client_id: 1 }, error: null },
        { data: { id: 20, vehicle_type: "BUS", quantity: 3 }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/deployments", "PUT", {
        id: 20,
        ...DECLARED_BUS_BODY,
        quantity: 3,
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.deployment.quantity).toBe(3);
    expect(supa.callCount("client_deployments")).toBe(2);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_CLIENT_DEPLOYMENT", recordId: 20 }),
    );
  });

  it("409s when the update collides with the unique-active-vehicle index", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_deployments: [
        { data: { id: 20, client_id: 1 }, error: null },
        { data: null, error: { code: "23505" } },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/deployments", "PUT", {
        id: 20,
        ...DECLARED_BUS_BODY,
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already deployed/);
  });

  it("surfaces a 500 for other update errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_deployments: [
        { data: { id: 20, client_id: 1 }, error: null },
        { data: null, error: { message: "connection reset" } },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/deployments", "PUT", {
        id: 20,
        ...DECLARED_BUS_BODY,
      }),
      params("1"),
    );

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/clients/[id]/deployments", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/clients/1/deployments?deployment_id=20"),
      params("1"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on invalid client or deployment IDs", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/clients/1/deployments?deployment_id=abc"),
      params("1"),
    );

    expect(res.status).toBe(400);
  });

  it("404s when the deployment doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ client_deployments: [{ data: null, error: null }] });
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/clients/1/deployments?deployment_id=20"),
      params("1"),
    );

    expect(res.status).toBe(404);
  });

  it("400s when the deployment belongs to a different client", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_deployments: [{ data: { id: 20, client_id: 2 }, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/clients/1/deployments?deployment_id=20"),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/different client/);
  });

  it("deletes the deployment and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_deployments: [
        { data: { id: 20, client_id: 1 }, error: null },
        { error: null },
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/clients/1/deployments?deployment_id=20"),
      params("1"),
    );

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_CLIENT_DEPLOYMENT", recordId: 20 }),
    );
  });

  it("surfaces a 500 when the delete fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_deployments: [
        { data: { id: 20, client_id: 1 }, error: null },
        { error: { message: "connection reset" } },
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/clients/1/deployments?deployment_id=20"),
      params("1"),
    );

    expect(res.status).toBe(500);
  });
});

describe("deployments: bad input that used to be a 500 or be stored as junk", () => {
  const call = (method: string, body: unknown, id = "1", raw?: string, query = "") =>
    [
      new NextRequest(`http://localhost/api/clients/${id}/deployments${query}`, {
        method,
        ...(method === "GET" || method === "DELETE" ? {} : { body: raw ?? JSON.stringify(body) }),
      }),
      params(id),
    ] as const;

  beforeEach(() => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
  });

  it.each([["malformed JSON", "{bad"], ["null", "null"], ["an empty body", ""]])(
    "POST and PUT answer 400 for %s",
    async (_label, raw) => {
      const { POST, PUT } = await importRoute();
      expect((await POST(...call("POST", undefined, "1", raw))).status).toBe(400);
      expect((await PUT(...call("PUT", undefined, "1", raw))).status).toBe(400);
    },
  );

  it.each(["1.5", "0", "abc"])("every method refuses %s as the client id", async (id) => {
    const { GET, POST, PUT, DELETE } = await importRoute();
    expect((await GET(...call("GET", undefined, id))).status).toBe(400);
    expect((await POST(...call("POST", DECLARED_BUS_BODY, id))).status).toBe(400);
    expect((await PUT(...call("PUT", { id: 1, ...DECLARED_BUS_BODY }, id))).status).toBe(400);
    expect((await DELETE(...call("DELETE", undefined, id, undefined, "?deployment_id=1"))).status).toBe(400);
  });

  it.each(["1.5", "abc", "0", ""])("DELETE refuses deployment_id=%s", async (deploymentId) => {
    const { DELETE } = await importRoute();
    const res = await DELETE(...call("DELETE", undefined, "1", undefined, `?deployment_id=${deploymentId}`));
    expect(res.status).toBe(400);
  });

  it.each([1.5, "", "abc", 0])("PUT refuses %j as the deployment id", async (id) => {
    const { PUT } = await importRoute();
    expect((await PUT(...call("PUT", { id, ...DECLARED_BUS_BODY }))).status).toBe(400);
  });

  it("refuses a vehicle id that is not a whole number", async () => {
    const { POST } = await importRoute();
    const res = await POST(...call("POST", { vehicle_id: 1.5 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid vehicle");
  });

  it("refuses a seating capacity or quantity far beyond anything real", async () => {
    const { POST } = await importRoute();
    const seats = await POST(...call("POST", { ...DECLARED_BUS_BODY, seating_capacity: 1e9 }));
    expect(seats.status).toBe(400);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const qty = await POST(...call("POST", { ...DECLARED_BUS_BODY, quantity: 1e9 }));
    expect(qty.status).toBe(400);
  });

  it("refuses notes that are not text or are too long", async () => {
    const { POST } = await importRoute();
    expect((await POST(...call("POST", { ...DECLARED_BUS_BODY, notes: { a: 1 } }))).status).toBe(400);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    expect((await POST(...call("POST", { ...DECLARED_BUS_BODY, notes: "n".repeat(501) }))).status).toBe(400);
  });

  it.each(["false", "true", 0, 1, {}])("refuses is_active = %j (only true or false)", async (flag) => {
    const { POST } = await importRoute();
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const res = await POST(...call("POST", { ...DECLARED_BUS_BODY, is_active: flag }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("is_active must be true or false");
  });
});

describe("deployment numbers must be real numbers", () => {
  it.each([
    ["quantity", { vehicle_type: "TRUCK", truck_type: "LCV", quantity: true }],
    ["quantity", { vehicle_type: "TRUCK", truck_type: "LCV", quantity: [5] }],
    ["quantity", { vehicle_type: "TRUCK", truck_type: "LCV", quantity: "3" }],
    ["seating_capacity", { vehicle_type: "BUS", seating_capacity: "43" }],
    ["seating_capacity", { vehicle_type: "BUS", seating_capacity: true }],
  ])("400s on a non-number %s", async (_field, payload) => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/deployments", "POST", payload),
      params("1"),
    );

    expect(res.status).toBe(400);
  });
});
