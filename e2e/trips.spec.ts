import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { testLabel } from "./support/run-id";

let api: APIRequestContext;
let vehicle: { id: number; vehicle_type: string };

test.beforeAll(async ({ baseURL }) => {
  api = await request.newContext({ baseURL, storageState: "e2e/.auth/admin.json" });
  const response = await api.get("/api/vehicles?page=1&pageSize=1");
  expect(response.ok(), await response.text()).toBeTruthy();
  vehicle = (await response.json()).data.data[0];
  expect(vehicle, "E2E requires at least one vehicle").toBeTruthy();
});

test.afterAll(async () => {
  await api.dispose();
});

async function deleteTrip(id: number) {
  await api.delete(`/api/trip-bookings?id=${id}`).catch(() => {});
}

const costItems = [
  { label: "Diesel", amount: 400 },
  { label: "Driver", amount: 300 },
];

test("completes a booking into one unified trip record", async () => {
  const customerName = testLabel("Unified booking");
  let bookingId: number | undefined;

  try {
    const create = await api.post("/api/trip-bookings", {
      data: {
        customer_name: customerName,
        from_location: "Hyderabad",
        to_location: "Bengaluru",
        start_date: "2026-12-20",
        vehicle_type: vehicle.vehicle_type,
        vehicle_id: vehicle.id,
        quoted_amount: 1500,
        advance_amount: 500,
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    bookingId = (await create.json()).data.booking.id;

    const complete = await api.post("/api/trip-bookings/complete", {
      data: {
        booking_id: bookingId,
        vehicle_id: vehicle.id,
        trip_type: "external_user",
        customer_name: customerName,
        from_location: "Hyderabad",
        to_location: "Bengaluru",
        start_date: "2026-12-20",
        cost_items: costItems,
        amount_received: 1500,
      },
    });
    expect(complete.ok(), await complete.text()).toBeTruthy();

    const completed = (await complete.json()).data.booking;
    expect(completed.status).toBe("completed");
    expect(Number(completed.total_cost)).toBe(700);
    expect(Number(completed.amount_received)).toBe(1500);
    expect(completed.completed_at).toBeTruthy();
  } finally {
    if (bookingId) await deleteTrip(bookingId);
  }
});

test("records an unplanned completed trip in the unified Trips table", async () => {
  const customerName = testLabel("Direct trip");
  let tripId: number | undefined;

  try {
    const complete = await api.post("/api/trip-bookings/complete", {
      data: {
        vehicle_id: vehicle.id,
        trip_type: "company_oncall",
        customer_name: customerName,
        from_location: "Hyderabad",
        to_location: "Vijayawada",
        start_date: "2026-12-21",
        cost_items: costItems,
        amount_received: 1800,
      },
    });
    expect(complete.ok(), await complete.text()).toBeTruthy();

    const trip = (await complete.json()).data.booking;
    tripId = trip.id;
    expect(trip.status).toBe("completed");
    expect(trip.vehicle_id).toBe(vehicle.id);
    expect(trip.advance_amount).toBe(0);
    expect(Number(trip.total_cost)).toBe(700);
    expect(Number(trip.amount_received)).toBe(1800);
  } finally {
    if (tripId) await deleteTrip(tripId);
  }
});