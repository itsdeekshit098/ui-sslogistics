import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import {
  requireUserAuth,
  requireAdminAuth,
  requireStrictAdminAuth,
} from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, DRIVER_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/drivers/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function rawRequest(url: string, method: string, rawBody: string) {
  return new NextRequest(url, { method, body: rawBody });
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

  it("withholds dl_number from the driver role but keeps phone (used by the diesel picker)", async () => {
    requireUserAuth.mockResolvedValue(DRIVER_USER);
    mockSupabaseAdmin({
      drivers: [
        {
          data: [{ id: 1, name: "Ravi", phone: "9876543210", dl_number: "KA0120230001234" }],
          error: null,
          count: 1,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/drivers"));
    const body = await res.json();

    expect(body.data.data[0].phone).toBe("9876543210");
    expect(body.data.data[0].dl_number).toBeNull();
  });

  it("keeps dl_number for admin, staff and superadmin", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        {
          data: [{ id: 1, name: "Ravi", phone: "9876543210", dl_number: "KA0120230001234" }],
          error: null,
          count: 1,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/drivers"));
    const body = await res.json();

    expect(body.data.data[0].dl_number).toBe("KA0120230001234");
  });

  it("returns no results (not every row) when the search term is only PostgREST-special characters", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    // No "drivers" fixture queued: if the route fell through to building and
    // running the query, this mock would throw and the route would 500 —
    // only the short-circuit before any query keeps this test green.
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(`http://localhost/api/drivers?search=${encodeURIComponent("%_(")}`),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.total).toBe(0);
    expect(body.data.data).toEqual([]);
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

  it("400s instead of 500 on malformed JSON", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(rawRequest("http://localhost/api/drivers", "POST", "{bad"));

    expect(res.status).toBe(400);
  });

  it("400s instead of 500 when name is not a string", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", { name: 12345 }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when name is over the length cap", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", { name: "A".repeat(201) }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on a photo_url that isn't http(s)", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", {
        name: "Ravi",
        photo_url: "javascript:alert(1)",
      }),
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

  it("400s instead of 500 on malformed JSON", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(rawRequest("http://localhost/api/drivers", "PUT", "{bad"));

    expect(res.status).toBe(400);
  });

  it("400s instead of 500 when id is not a valid integer", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/drivers", "PUT", { id: "1.5", name: "Ravi" }),
    );

    expect(res.status).toBe(400);
  });

  it("404s instead of 500 when id doesn't match any driver", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: null, error: null }], // .maybeSingle() finds nothing
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/drivers", "PUT", { id: 999999, place: "X" }),
    );

    expect(res.status).toBe(404);
  });

  it("400s when is_active is a string instead of a boolean", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/drivers", "PUT", { id: 1, is_active: "false" }),
    );

    expect(res.status).toBe(400);
  });

  it("accepts a real boolean for is_active", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1, name: "Ravi", is_active: false }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/drivers", "PUT", { id: 1, is_active: false }),
    );

    expect(res.status).toBe(200);
  });

  it("400s when photo_url isn't http(s) on update", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/drivers", "PUT", {
        id: 1,
        photo_url: "javascript:alert(1)",
      }),
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
    "driver_salary_settlements",
    "driver_shift_counts",
    "driver_pay_types",
    "driver_trip_counts",
  ];
  const zeroCountFor = (except?: string): Record<string, { count: number | null; error: unknown }[]> =>
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

  it("400s when id is not a valid integer", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/drivers?id=1.5"));

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

describe("drivers — optional text fields must be text", () => {
  it.each(["phone", "place", "dl_number", "photo_url"])(
    "PUT 400s instead of clearing %s when it is sent as a number",
    async (field) => {
      requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
      const supa = mockSupabaseAdmin({});
      const { PUT } = await importRoute();

      const res = await PUT(
        jsonRequest("http://localhost/api/drivers", "PUT", { id: 1, [field]: 9876543210 }),
      );

      expect(res.status).toBe(400);
      expect(supa.callCount("drivers")).toBe(0);
    },
  );

  it("PUT still clears place when it is sent as null", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      drivers: [{ data: { id: 1, name: "Ravi", place: null }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/drivers", "PUT", { id: 1, place: null }),
    );

    expect(res.status).toBe(200);
    const builder = supa.from.mock.results[0].value as { update: { mock: { calls: unknown[][] } } };
    expect(builder.update.mock.calls[0][0]).toEqual({ place: null });
  });

  it("POST 400s when phone is sent as a number", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/drivers", "POST", { name: "Ravi", phone: 9876543210 }),
    );

    expect(res.status).toBe(400);
  });
});
