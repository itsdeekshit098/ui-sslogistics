import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/trip-bookings/complete/route");
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/trip-bookings/complete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const COST_ITEMS = [
  { label: "Diesel", amount: 2000 },
  { label: "Driver", amount: 500 },
];

beforeEach(() => {
  requireAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("POST /api/trip-bookings/complete", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ booking_id: 1, trip_type: "company_oncall", cost_items: COST_ITEMS, amount_received: 3000 }));

    expect(res.status).toBe(403);
  });

  it("404s when the referenced booking does not exist", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ booking_id: 1, trip_type: "company_oncall", cost_items: COST_ITEMS, amount_received: 3000 }));

    expect(res.status).toBe(404);
  });

  it("400s when the booking is not in 'confirmed' status", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ data: { id: 1, status: "cancelled", vehicle_id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ booking_id: 1, trip_type: "company_oncall", cost_items: COST_ITEMS, amount_received: 3000 }));

    expect(res.status).toBe(400);
  });

  it("400s on an invalid trip_type", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ data: { id: 1, status: "confirmed", vehicle_id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ booking_id: 1, trip_type: "joyride", cost_items: COST_ITEMS, amount_received: 3000 }));

    expect(res.status).toBe(400);
  });

  it("400s when a required cost item is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ data: { id: 1, status: "confirmed", vehicle_id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest({ booking_id: 1, trip_type: "company_oncall", cost_items: [{ label: "Diesel", amount: 100 }], amount_received: 3000 }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when no vehicle can be resolved (no booking and no vehicle_id)", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest({ trip_type: "company_oncall", cost_items: COST_ITEMS, amount_received: 3000 }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when the direct-completion mode is missing customer/route/date", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1, vehicle_type: "CAR" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest({
        trip_type: "company_oncall",
        cost_items: COST_ITEMS,
        amount_received: 3000,
        vehicle_id: 1,
      }),
    );

    expect(res.status).toBe(400);
  });

  it("completes an existing confirmed booking", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [
        { data: { id: 1, status: "confirmed", vehicle_id: 1 }, error: null },
        { data: { id: 1, status: "completed" }, error: null },
      ],
      vehicles: [{ data: { id: 1, vehicle_type: "CAR" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest({ booking_id: 1, trip_type: "company_oncall", cost_items: COST_ITEMS, amount_received: 3000 }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.booking.status).toBe("completed");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "COMPLETE_TRIP_BOOKING" }),
    );
  });

  it("creates a direct completed trip (no prior booking) when given full details", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1, vehicle_type: "CAR" }, error: null }],
      trip_bookings: [{ data: { id: 5, status: "completed" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest({
        trip_type: "external_user",
        cost_items: COST_ITEMS,
        amount_received: 3000,
        vehicle_id: 1,
        customer_name: "Ravi",
        from_location: "Chennai",
        to_location: "Bangalore",
        start_date: "2026-06-01",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.booking.id).toBe(5);
  });

  it("400s when the selected driver is inactive", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      trip_bookings: [{ data: { id: 1, status: "confirmed", vehicle_id: 1 }, error: null }],
      vehicles: [{ data: { id: 1, vehicle_type: "CAR" }, error: null }],
      drivers: [{ data: { id: 2, is_active: false }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest({
        booking_id: 1,
        trip_type: "company_oncall",
        cost_items: COST_ITEMS,
        amount_received: 3000,
        driver_id: 2,
      }),
    );

    expect(res.status).toBe(400);
  });
});
