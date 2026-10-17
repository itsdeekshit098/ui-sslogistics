import { type Page, type Request } from "@playwright/test";

/**
 * In-memory mock for the Trips flows exercised by trips.spec.ts:
 * create a booking (POST /api/trip-bookings), complete it or record a direct
 * completed trip (POST /api/trip-bookings/complete), and delete it (DELETE
 * /api/trip-bookings?id=). Mirrors the real route's response shapes closely
 * enough for the spec's assertions (status, total_cost, amount_received,
 * vehicle_id, advance_amount, completed_at).
 */

export const VEHICLE_ID = 501;
export const VEHICLE_TYPE = "TRUCK";

export type MockApi = {
  requests: Request[];
  payloads: Array<{ url: string; method: string; body: unknown }>;
};

export function successfulJson(data: unknown, message = "Success") {
  return { success: true, data, message };
}

export function vehicleFixture(overrides: Partial<{ id: number; vehicle_type: string }> = {}) {
  return {
    id: VEHICLE_ID,
    vehicle_type: VEHICLE_TYPE,
    vehicle_number: "TN-01-AB-1234",
    company: "Tata",
    model: "407",
    ...overrides,
  };
}

type Booking = Record<string, unknown> & {
  id: number;
  status: string;
  vehicle_id: number | null;
  advance_amount: number;
};

export async function installTripsMocks(page: Page): Promise<MockApi> {
  const requests: Request[] = [];
  const payloads: MockApi["payloads"] = [];
  const bookings = new Map<number, Booking>();
  let nextId = 9001;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    requests.push(request);
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    let body: unknown = null;
    if (method !== "GET" && method !== "DELETE") {
      try {
        body = request.postDataJSON();
      } catch {
        body = request.postData();
      }
    }
    payloads.push({ url: `${path}${url.search}`, method, body });

    if (path === "/api/auth/session" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successfulJson({
            id: "mock-user",
            email: "mock@example.test",
            role: "admin",
            displayName: "Mock Admin",
          }),
        ),
      });
    }

    if (path === "/api/vehicles" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successfulJson({ data: [vehicleFixture()], total: 1 }),
        ),
      });
    }

    if (path === "/api/trip-bookings" && method === "POST") {
      const values = body as Record<string, unknown>;
      const booking: Booking = {
        id: nextId++,
        status: "confirmed",
        customer_name: values.customer_name,
        from_location: values.from_location,
        to_location: values.to_location,
        start_date: values.start_date,
        vehicle_type: values.vehicle_type,
        vehicle_id: values.vehicle_id ? Number(values.vehicle_id) : null,
        quoted_amount: values.quoted_amount ?? null,
        advance_amount: Number(values.advance_amount ?? 0),
        total_cost: null,
        amount_received: null,
        completed_at: null,
      };
      bookings.set(booking.id, booking);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ booking }, "Booking created")),
      });
    }

    if (path === "/api/trip-bookings/complete" && method === "POST") {
      const values = body as Record<string, unknown>;
      const costItems = (values.cost_items as Array<{ amount: number }>) ?? [];
      const totalCost = costItems.reduce((sum, item) => sum + Number(item.amount), 0);
      const bookingId = values.booking_id != null ? Number(values.booking_id) : null;
      const existing = bookingId != null ? bookings.get(bookingId) : undefined;

      const completed: Booking = {
        ...(existing ?? {
          id: nextId++,
          advance_amount: 0,
        }),
        id: existing?.id ?? nextId - 1,
        status: "completed",
        trip_type: values.trip_type,
        vehicle_id: values.vehicle_id ? Number(values.vehicle_id) : existing?.vehicle_id ?? null,
        customer_name: values.customer_name ?? existing?.customer_name ?? null,
        from_location: values.from_location ?? existing?.from_location ?? null,
        to_location: values.to_location ?? existing?.to_location ?? null,
        start_date: values.start_date ?? existing?.start_date ?? null,
        cost_items: costItems,
        total_cost: totalCost,
        amount_received: Number(values.amount_received),
        completed_at: new Date().toISOString(),
        advance_amount: existing?.advance_amount ?? 0,
      };
      bookings.set(completed.id, completed);

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ booking: completed }, "Trip completed")),
      });
    }

    if (path === "/api/trip-bookings" && method === "DELETE") {
      const id = Number(url.searchParams.get("id"));
      bookings.delete(id);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson(null, "Booking deleted")),
      });
    }

    if (path.startsWith("/api/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({})),
      });
    }

    throw new Error(`Unexpected non-API request passed to API mock: ${request.url()}`);
  });

  return { requests, payloads };
}
