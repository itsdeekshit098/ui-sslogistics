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
  return await import("@/app/api/drivers/route");
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

describe("GET /api/drivers", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/drivers"));

    expect(res.status).toBe(403);
  });

  it("lists active drivers by default", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [{ id: 1, name: "Ravi" }], error: null, count: 1 }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/drivers"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.total).toBe(1);
  });

  it("surfaces a 500 when the list query errors", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: null, error: { message: "timeout" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/drivers"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/drivers", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", { name: "Ravi" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when name is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", { name: "" }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid phone number", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", {
        name: "Ravi",
        phone: "12345",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("409s when an exact-normalized name already exists", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        {
          data: [{ id: 1, name: "RAVI KUMAR", place: "Chennai", phone: null, dl_number: null, is_active: true }],
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", { name: "Ravi Kumar" }),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already exists/);
  });

  it("409s when the DL number already belongs to someone else", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        {
          data: [{ id: 1, name: "Someone Else", place: null, phone: null, dl_number: "KA0120230001234", is_active: true }],
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", {
        name: "Ravi Kumar",
        dl_number: "KA0120230001234",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/DL number already belongs/);
  });

  it("409s with SIMILAR_DRIVER_EXISTS when a near-duplicate name is found and not confirmed", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        {
          data: [{ id: 1, name: "Mehaboob", place: "Chennai", phone: "9876543210", dl_number: null, is_active: true }],
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", { name: "Mahaboob" }),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("SIMILAR_DRIVER_EXISTS");
    expect(body.similar).toHaveLength(1);
  });

  it("creates the driver anyway when confirm_similar is true", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        {
          data: [{ id: 1, name: "Mehaboob", place: null, phone: null, dl_number: null, is_active: true }],
          error: null,
        },
        { data: { id: 2, name: "Mahaboob" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", {
        name: "Mahaboob",
        confirm_similar: true,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.driver.id).toBe(2);
  });

  it("creates the driver and logs the audit entry when there is no duplicate at all", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        { data: [], error: null },
        { data: { id: 5, name: "New Driver" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", { name: "New Driver" }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.driver.id).toBe(5);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_DRIVER" }),
    );
  });

  it("confirm_similar never waives the exact-name check", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        {
          data: [{ id: 1, name: "RAVI KUMAR", place: null, phone: null, dl_number: null, is_active: true }],
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", {
        name: "Ravi Kumar",
        confirm_similar: true,
      }),
    );

    expect(res.status).toBe(409);
  });
});

describe("PUT /api/drivers", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/drivers", "PUT", { id: 1, name: "New" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/drivers", "PUT", { name: "New" }));

    expect(res.status).toBe(400);
  });

  it("400s when name is set to an empty string", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/drivers", "PUT", { id: 1, name: "  " }),
    );

    expect(res.status).toBe(400);
  });

  it("updates the driver without re-checking duplicates when name/dl_number aren't touched", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      drivers: [{ data: { id: 1, name: "Ravi", place: "New Place" }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/drivers", "PUT", { id: 1, place: "New Place" }),
    );

    expect(res.status).toBe(200);
    expect(supa.callCount("drivers")).toBe(1);
  });

  it("allows saving a driver's own unchanged name — excludeId covers this", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        { data: { name: "Ravi Kumar", dl_number: null }, error: null }, // current row fetch
        { data: [{ id: 1, name: "Ravi Kumar", place: null, phone: null, dl_number: null, is_active: true }], error: null }, // findDuplicates query
        { data: { id: 1, name: "Ravi Kumar" }, error: null }, // update
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/drivers", "PUT", { id: 1, name: "Ravi Kumar" }),
    );

    expect(res.status).toBe(200);
  });

  it("409s when renaming onto another existing driver's exact name", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        { data: { name: "Ravi", dl_number: null }, error: null },
        {
          data: [{ id: 2, name: "SURESH KUMAR", place: null, phone: null, dl_number: null, is_active: true }],
          error: null,
        },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/drivers", "PUT", { id: 1, name: "Suresh Kumar" }),
    );

    expect(res.status).toBe(409);
  });

  it("logs the audit entry on a successful update", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1, name: "Ravi", place: "Updated" }, error: null }],
    });
    const { PUT } = await importRoute();

    await PUT(jsonRequest("http://localhost/api/drivers", "PUT", { id: 1, place: "Updated" }));

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_DRIVER", recordId: 1 }),
    );
  });
});

describe("DELETE /api/drivers", () => {
  const dependentTables = [
    "external_trips",
    "trip_bookings",
    "driver_attendance",
    "driver_salary_rates",
    "driver_salary_entries",
    "driver_shift_counts",
  ];
  const zeroCountFor = (except?: string) =>
    Object.fromEntries(
      dependentTables.map((t) => [t, [{ count: t === except ? 5 : 0, error: null }]]),
    );

  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/drivers?id=1"));

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/drivers"));

    expect(res.status).toBe(400);
  });

  it.each(dependentTables)(
    "blocks deletion when %s has dependent rows",
    async (table) => {
      requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
      mockSupabaseAdmin(zeroCountFor(table));
      const { DELETE } = await importRoute();

      const res = await DELETE(new NextRequest("http://localhost/api/drivers?id=1"));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toMatch(/Deactivate them instead/);
    },
  );

  it("skips a dependent table that doesn't exist in this database, rather than erroring", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const responses = zeroCountFor();
    responses.external_trips = [{ count: null, error: { code: "42P01" } }];
    mockSupabaseAdmin({ ...responses, drivers: [{ error: null }] });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/drivers?id=1"));

    expect(res.status).toBe(200);
  });

  it("surfaces a 500 for a genuine dependent-check query error", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const responses = zeroCountFor();
    responses.external_trips = [{ count: null, error: { message: "timeout" } }];
    mockSupabaseAdmin(responses);
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/drivers?id=1"));

    expect(res.status).toBe(500);
  });

  it("deletes the driver and logs the audit entry when nothing blocks it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ ...zeroCountFor(), drivers: [{ error: null }] });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/drivers?id=1"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_DRIVER", recordId: 1 }),
    );
  });

  it("surfaces a 500 when the final delete fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      ...zeroCountFor(),
      drivers: [{ error: { message: "fk violation" } }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/drivers?id=1"));

    expect(res.status).toBe(500);
  });
});
