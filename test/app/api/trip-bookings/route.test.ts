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
  return await import("@/app/api/trip-bookings/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const VALID_BOOKING = {
  customer_name: "Ravi",
  from_location: "Chennai",
  to_location: "Bangalore",
  start_date: "2026-07-01",
  vehicle_type: "CAR",
};

beforeEach(() => {
  requireUserAuth.mockReset();
  requireAdminAuth.mockReset();
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/trip-bookings", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/trip-bookings"));

    expect(res.status).toBe(403);
  });

  it("omits the summary unless include_summary=true", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ data: [], error: null, count: 0 }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/trip-bookings"));
    const body = await res.json();

    expect(body.data.summary).toBeUndefined();
  });

  it("computes the summary with profit when include_summary=true", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [
        { count: 2, error: null }, // upcoming
        { count: 1, error: null }, // overdue
        { count: 5, error: null }, // completed
        { count: 1, error: null }, // cancelled
        { data: [{ total_cost: 1000, amount_received: 1500 }, { total_cost: 500, amount_received: 700 }], error: null }, // completed finance
        { data: [], error: null, count: 0 }, // data query
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/trip-bookings?include_summary=true"),
    );
    const body = await res.json();

    expect(body.data.summary).toEqual({
      upcomingCount: 2,
      overdueCount: 1,
      completedCount: 5,
      cancelledCount: 1,
      totalCost: 1500,
      totalReceived: 2200,
      totalProfit: 700,
    });
  });

  it("surfaces a 500 if any summary sub-query errors", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [
        { count: null, error: { message: "timeout" } },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/trip-bookings?include_summary=true"),
    );

    expect(res.status).toBe(500);
  });
});

describe("POST /api/trip-bookings", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/trip-bookings", "POST", VALID_BOOKING));

    expect(res.status).toBe(403);
  });

  it("400s when customer_name is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/trip-bookings", "POST", { ...VALID_BOOKING, customer_name: "" }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid vehicle_type", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/trip-bookings", "POST", { ...VALID_BOOKING, vehicle_type: "UFO" }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when seating_capacity is given for a vehicle type that doesn't take one", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/trip-bookings", "POST", {
        ...VALID_BOOKING,
        vehicle_type: "TRUCK",
        seating_capacity: 4,
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when the selected driver is inactive", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: { id: 1, is_active: false }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/trip-bookings", "POST", { ...VALID_BOOKING, driver_id: 1 }),
    );

    expect(res.status).toBe(400);
  });

  it("creates the booking with status 'confirmed' and logs the audit entry", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ data: { id: 1, status: "confirmed" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/trip-bookings", "POST", VALID_BOOKING));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.booking.status).toBe("confirmed");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_TRIP_BOOKING" }),
    );
  });
});

describe("PUT /api/trip-bookings", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/trip-bookings", "PUT", { id: 1 }));

    expect(res.status).toBe(403);
  });

  it("404s when the booking does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ data: null, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/trip-bookings", "PUT", { id: 1 }));

    expect(res.status).toBe(404);
  });

  it("400s when trying to edit a completed booking", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ data: { id: 1, status: "completed", vehicle_type: "CAR" }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/trip-bookings", "PUT", { id: 1, notes: "new note" }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when trying to set status to anything other than cancelled", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ data: { id: 1, status: "confirmed", vehicle_type: "CAR" }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/trip-bookings", "PUT", { id: 1, status: "completed" }),
    );

    expect(res.status).toBe(400);
  });

  it("allows cancelling a confirmed booking", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [
        { data: { id: 1, status: "confirmed", vehicle_type: "CAR" }, error: null },
        { data: { id: 1, status: "cancelled" }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/trip-bookings", "PUT", { id: 1, status: "cancelled" }),
    );

    expect(res.status).toBe(200);
  });

  it("400s when seating_capacity doesn't apply to the effective vehicle_type", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ data: { id: 1, status: "confirmed", vehicle_type: "TRUCK" }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/trip-bookings", "PUT", { id: 1, seating_capacity: 4 }),
    );

    expect(res.status).toBe(400);
  });

  it("updates the booking and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [
        { data: { id: 1, status: "confirmed", vehicle_type: "CAR" }, error: null },
        { data: { id: 1, notes: "updated" }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/trip-bookings", "PUT", { id: 1, notes: "updated" }),
    );

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_TRIP_BOOKING", recordId: 1 }),
    );
  });
});

describe("DELETE /api/trip-bookings", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/trip-bookings?id=1"));

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/trip-bookings"));

    expect(res.status).toBe(400);
  });

  it("deletes the booking and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/trip-bookings?id=1"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_TRIP_BOOKING", recordId: 1 }),
    );
  });
});
