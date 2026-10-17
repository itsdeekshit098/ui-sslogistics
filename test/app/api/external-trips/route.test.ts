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
  return await import("@/app/api/external-trips/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const VALID_COST_ITEMS = [
  { label: "Diesel", amount: 2000 },
  { label: "Driver", amount: 500 },
];

const VALID_TRIP = {
  vehicle_id: 1,
  trip_type: "company_oncall",
  cost_items: VALID_COST_ITEMS,
  amount_received: 5000,
};

beforeEach(() => {
  requireUserAuth.mockReset();
  requireAdminAuth.mockReset();
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/external-trips", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/external-trips"));

    expect(res.status).toBe(403);
  });

  it("includes a summary by default", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      { external_trips: [{ data: [], error: null, count: 0 }] },
      {
        get_external_trips_summary: [
          { data: [{ total_count: 5, total_cost: 1000, total_received: 1500 }], error: null },
        ],
      },
    );
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/external-trips"));
    const body = await res.json();

    expect(body.data.summary).toEqual({
      totalCost: 1000,
      totalReceived: 1500,
      totalProfit: 500,
      count: 5,
    });
    expect(body.data.total).toBe(5);
  });

  it("omits the summary when include_summary=false, using the page count as total", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      external_trips: [{ data: [], error: null, count: 3 }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/external-trips?include_summary=false"),
    );
    const body = await res.json();

    expect(body.data.summary).toBeUndefined();
    expect(body.data.total).toBe(3);
  });

  it("surfaces a 500 when the summary RPC errors", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {},
      { get_external_trips_summary: [{ data: null, error: { message: "timeout" } }] },
    );
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/external-trips"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/external-trips", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/external-trips", "POST", VALID_TRIP));

    expect(res.status).toBe(403);
  });

  it("400s on a missing vehicle_id", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/external-trips", "POST", { ...VALID_TRIP, vehicle_id: undefined }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when the vehicle does not exist", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/external-trips", "POST", VALID_TRIP));

    expect(res.status).toBe(400);
  });

  it("400s on an invalid trip_type", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/external-trips", "POST", { ...VALID_TRIP, trip_type: "joyride" }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when a required cost item (Diesel/Driver) is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/external-trips", "POST", {
        ...VALID_TRIP,
        cost_items: [{ label: "Diesel", amount: 100 }],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/"Driver" cost item is required/);
  });

  it("400s on a negative cost item amount", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/external-trips", "POST", {
        ...VALID_TRIP,
        cost_items: [{ label: "Diesel", amount: -5 }, { label: "Driver", amount: 100 }],
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on a negative amount_received", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/external-trips", "POST", {
        ...VALID_TRIP,
        amount_received: -1,
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid customer phone", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/external-trips", "POST", {
        ...VALID_TRIP,
        customer_phone: "12345",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when the selected driver is inactive", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      drivers: [{ data: { id: 1, is_active: false }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/external-trips", "POST", { ...VALID_TRIP, driver_id: 1 }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when end_date is before start_date", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/external-trips", "POST", {
        ...VALID_TRIP,
        start_date: "2026-06-10",
        end_date: "2026-06-01",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("creates the trip and logs the audit entry with the correct total_cost", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      external_trips: [{ data: { id: 10 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/external-trips", "POST", VALID_TRIP));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.trip.id).toBe(10);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_EXTERNAL_TRIP", details: expect.objectContaining({ total_cost: 2500 }) }),
    );
  });

  it("400s when the linked booking is not confirmed", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      trip_bookings: [{ data: { id: 7, status: "pending" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/external-trips", "POST", { ...VALID_TRIP, booking_id: 7 }),
    );

    expect(res.status).toBe(400);
  });

  it("completes the linked booking on success", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      trip_bookings: [
        { data: { id: 7, status: "confirmed" }, error: null }, // lookup
        { data: [{ id: 7 }], error: null }, // the completing update
      ],
      external_trips: [{ data: { id: 10 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/external-trips", "POST", { ...VALID_TRIP, booking_id: 7 }),
    );

    expect(res.status).toBe(201);
  });

  it("deletes the orphaned trip (compensating transaction) when the booking can't be completed", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      trip_bookings: [
        { data: { id: 7, status: "confirmed" }, error: null },
        { data: [], error: null }, // concurrent race: zero rows updated
      ],
      external_trips: [
        { data: { id: 10 }, error: null }, // insert
        { error: null }, // compensating delete
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/external-trips", "POST", { ...VALID_TRIP, booking_id: 7 }),
    );

    expect(res.status).toBe(500);
    expect(supa.callCount("external_trips")).toBe(2);
  });
});

describe("PUT /api/external-trips", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/external-trips", "PUT", { id: 1, notes: "updated" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/external-trips", "PUT", { notes: "x" }));

    expect(res.status).toBe(400);
  });

  it("400s when updated cost_items are missing a required label", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/external-trips", "PUT", {
        id: 1,
        cost_items: [{ label: "Diesel", amount: 100 }],
      }),
    );

    expect(res.status).toBe(400);
  });

  it("recomputes total_cost when cost_items changes", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      external_trips: [{ data: { id: 1, total_cost: 2500 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/external-trips", "PUT", {
        id: 1,
        cost_items: VALID_COST_ITEMS,
      }),
    );

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ total_cost: 2500 }) }),
    );
  });

  it("400s when end_date is before start_date after merging with existing values", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/external-trips", "PUT", {
        id: 1,
        start_date: "2026-06-10",
        end_date: "2026-06-01",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("updates the trip and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      external_trips: [{ data: { id: 1, notes: "updated" }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/external-trips", "PUT", { id: 1, notes: "updated" }),
    );

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_EXTERNAL_TRIP", recordId: 1 }),
    );
  });
});

describe("DELETE /api/external-trips", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/external-trips?id=1"));

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/external-trips"));

    expect(res.status).toBe(400);
  });

  it("reopens the linked booking before deleting the trip", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      trip_bookings: [
        { data: { id: 7 }, error: null }, // linked booking lookup
        { error: null }, // reopen update
      ],
      external_trips: [{ error: null }], // delete
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/external-trips?id=1"));

    expect(res.status).toBe(200);
    expect(supa.callCount("trip_bookings")).toBe(2);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_EXTERNAL_TRIP", recordId: 1 }),
    );
  });

  it("deletes the trip directly when no booking is linked", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ data: null, error: null }],
      external_trips: [{ error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/external-trips?id=1"));

    expect(res.status).toBe(200);
  });
});
