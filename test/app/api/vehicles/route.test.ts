import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import {
  requireUserAuth,
  requireAdminAuth,
  requireStrictAdminAuth,
} from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { notifyRoles } from "@test/notificationsMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/vehicles/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const MINIMAL_CAR = { vehicle_number: "KA01AB1234", vehicle_type: "CAR", seating_capacity: 4 };

beforeEach(() => {
  requireUserAuth.mockReset();
  requireAdminAuth.mockReset();
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
  notifyRoles.mockReset();
});

describe("GET /api/vehicles", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/vehicles"));

    expect(res.status).toBe(403);
  });

  it("lists vehicles with zeroed stats when the summary RPC fails, rather than 500ing the whole list", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      { vehicles: [{ data: [{ id: 1, vehicle_number: "KA01AB1234" }], error: null, count: 1 }] },
      { get_vehicles_summary: [{ data: null, error: { message: "not applied yet" } }] },
    );
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/vehicles"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.stats).toEqual({ total: 0, active: 0, maintenance: 0, idle: 0 });
  });

  it("populates stats from the summary RPC when it succeeds", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      { vehicles: [{ data: [], error: null, count: 0 }] },
      {
        get_vehicles_summary: [
          { data: [{ total_count: 10, active_count: 8, maintenance_count: 1, idle_count: 1 }], error: null },
        ],
      },
    );
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/vehicles"));
    const body = await res.json();

    expect(body.data.stats).toEqual({ total: 10, active: 8, maintenance: 1, idle: 1 });
  });

  it("computes fc_status/insurance_status per row", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {
        vehicles: [
          {
            data: [{ id: 1, fc_end_date: "2020-01-01", insurance_end_date: "2099-01-01" }],
            error: null,
            count: 1,
          },
        ],
      },
      { get_vehicles_summary: [{ data: [], error: null }] },
    );
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/vehicles"));
    const body = await res.json();

    expect(body.data.data[0].fc_status).toBe("expired");
    expect(body.data.data[0].insurance_status).toBe("active");
  });

  it("surfaces a 500 when the list query itself errors", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ vehicles: [{ data: null, error: { message: "timeout" } }] });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/vehicles"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/vehicles", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/vehicles", "POST", MINIMAL_CAR));

    expect(res.status).toBe(403);
  });

  it("400s when TRUCK has no truck_type", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicles", "POST", {
        vehicle_number: "KA01AB1234",
        vehicle_type: "TRUCK",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when CONTAINER is missing container_length/axle_type/container_body_type", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicles", "POST", {
        vehicle_number: "KA01AB1234",
        vehicle_type: "CONTAINER",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when a CAR has no seating_capacity", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicles", "POST", {
        vehicle_number: "KA01AB1234",
        vehicle_type: "CAR",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid fuel_type", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicles", "POST", { ...MINIMAL_CAR, fuel_type: "COAL" }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when insurance end date is before the start date", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicles", "POST", {
        ...MINIMAL_CAR,
        insurance_start_date: "2026-06-01",
        insurance_end_date: "2026-01-01",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when setting insurance dates without an insurance document uploaded", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicles", "POST", {
        ...MINIMAL_CAR,
        insurance_start_date: "2026-01-01",
        insurance_end_date: "2026-12-31",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Upload the Insurance document/);
  });

  it("allows insurance dates when insurance_url is present in the same request", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicles", "POST", {
        ...MINIMAL_CAR,
        insurance_start_date: "2026-01-01",
        insurance_end_date: "2026-12-31",
        insurance_url: "https://example.com/doc.pdf",
      }),
    );

    expect(res.status).toBe(201);
  });

  it("400s when owner_name does not resolve to an existing entity", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicles", "POST", { ...MINIMAL_CAR, owner_name: "Nobody" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Unknown Owner/);
  });

  it("derives owner_type from the resolved entity's relationship", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 5, name: "Acme", relationship: "EXTERNAL" }, error: null }],
      vehicles: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicles", "POST", { ...MINIMAL_CAR, owner_entity_id: 5 }),
    );

    expect(res.status).toBe(201);
  });

  it("400s when the supplied owner_type contradicts the resolved entity", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 5, name: "Acme", relationship: "EXTERNAL" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicles", "POST", {
        ...MINIMAL_CAR,
        owner_entity_id: 5,
        owner_type: "OWN",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("creates the vehicle, logs the audit entry, and notifies admin/staff", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 42 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/vehicles", "POST", MINIMAL_CAR));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.id).toBe(42);
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATE_VEHICLE" }));
    expect(notifyRoles).toHaveBeenCalledWith(
      expect.objectContaining({ type: "vehicle_created", excludeUserId: ADMIN_USER.id }),
    );
  });

  it("409s when the vehicle number already exists", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: null, error: { code: "23505" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/vehicles", "POST", MINIMAL_CAR));

    expect(res.status).toBe(409);
  });

  it("trims the vehicle_number to avoid near-duplicate rows with trailing whitespace", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vehicles", "POST", {
        ...MINIMAL_CAR,
        vehicle_number: "  KA01AB1234  ",
      }),
    );

    expect(res.status).toBe(201);
  });
});

describe("PUT /api/vehicles", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/vehicles", "PUT", { id: 1, ...MINIMAL_CAR }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/vehicles", "PUT", MINIMAL_CAR));

    expect(res.status).toBe(400);
  });

  it("400s when setting FC dates without an fc document already saved and none supplied in the body", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { fc_url: null }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/vehicles", "PUT", {
        id: 1,
        fc_start_date: "2026-01-01",
        fc_end_date: "2026-12-31",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("allows setting FC dates when the document is already saved on the vehicle", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [
        { data: { fc_url: "https://example.com/fc.pdf" }, error: null },
        { data: { vehicle_number: "KA01AB1234" }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/vehicles", "PUT", {
        id: 1,
        fc_start_date: "2026-01-01",
        fc_end_date: "2026-12-31",
      }),
    );

    expect(res.status).toBe(200);
  });

  it("updates the vehicle, logs the audit entry, and notifies", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { vehicle_number: "KA01AB1234" }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/vehicles", "PUT", { id: 1, status: "MAINTENANCE" }),
    );

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_VEHICLE", recordId: 1 }),
    );
    expect(notifyRoles).toHaveBeenCalledWith(expect.objectContaining({ type: "vehicle_updated" }));
  });

  it("409s when renaming onto an existing vehicle number", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: null, error: { code: "23505" } }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/vehicles", "PUT", { id: 1, vehicle_number: "DUP123" }),
    );

    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/vehicles", () => {
  const dependentTables = [
    "repair_records",
    "warranty",
    "repair_parts",
    "external_trips",
    "diesel_records",
    "trip_bookings",
    "loans",
  ];
  const vehicleRow = {
    vehicle_number: "KA01AB1234",
    vehicle_type: "CAR",
    company: null,
    model: null,
    rc_url: null,
    fc_url: null,
    insurance_url: null,
    permit_url: null,
    pollution_url: null,
    tax_url: null,
  };
  const zeroCountFor = (except?: string) =>
    Object.fromEntries(
      dependentTables.map((t) => [t, [{ count: t === except ? 2 : 0, error: null }]]),
    );

  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/vehicles?id=1"));

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/vehicles"));

    expect(res.status).toBe(400);
  });

  it("404s when the vehicle does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: null, error: { message: "not found" } }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/vehicles?id=1"));

    expect(res.status).toBe(404);
  });

  it("blocks deletion when any dependent table has rows", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: vehicleRow, error: null }],
      ...zeroCountFor("loans"),
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/vehicles?id=1"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/2 loans/);
  });

  it("blocks permanent deletion while allow_permanent_delete is false", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [
        { data: vehicleRow, error: null },
        { data: { allow_permanent_delete: false }, error: null },
      ],
      ...zeroCountFor(),
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/vehicles?id=1"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("VEHICLE_DELETE_LOCKED");
  });

  it("deletes the vehicle, its storage documents and photos, and logs + notifies", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [
        { data: { ...vehicleRow, rc_url: "docs/rc.pdf" }, error: null },
        { data: { allow_permanent_delete: true }, error: null },
        { error: null }, // delete
      ],
      attachments: [{ data: [{ storage_path: "photos/img1.jpg" }], error: null }],
      ...zeroCountFor(),
    });
    const supa = mockSupabaseAdmin(
      {
        vehicles: [
          { data: { ...vehicleRow, rc_url: "docs/rc.pdf" }, error: null },
          { data: { allow_permanent_delete: true }, error: null },
          { error: null },
        ],
        attachments: [{ data: [{ storage_path: "photos/img1.jpg" }], error: null }],
        ...zeroCountFor(),
      },
    );
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/vehicles?id=1"));

    expect(res.status).toBe(200);
    expect(supa.storageRemoveCallCount("vehicle-documents")).toBe(1);
    expect(supa.storageRemoveCallCount("attachments")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_VEHICLE", recordId: 1 }),
    );
    expect(notifyRoles).toHaveBeenCalledWith(expect.objectContaining({ type: "vehicle_deleted" }));
  });

  it("skips storage cleanup entirely when the vehicle has no documents or photos", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      vehicles: [
        { data: vehicleRow, error: null },
        { data: { allow_permanent_delete: true }, error: null },
        { error: null },
      ],
      attachments: [{ data: [], error: null }],
      ...zeroCountFor(),
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/vehicles?id=1"));

    expect(res.status).toBe(200);
    expect(supa.storageRemoveCallCount()).toBe(0);
  });

  it("skips a dependent table that doesn't exist, rather than erroring", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const responses = zeroCountFor();
    responses.external_trips = [{ count: null, error: { code: "42P01" } }];
    mockSupabaseAdmin({
      vehicles: [
        { data: vehicleRow, error: null },
        { data: { allow_permanent_delete: true }, error: null },
        { error: null },
      ],
      attachments: [{ data: [], error: null }],
      ...responses,
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/vehicles?id=1"));

    expect(res.status).toBe(200);
  });
});
