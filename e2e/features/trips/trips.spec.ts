import { expect, test } from "@playwright/test";
import { installTripsMocks, VEHICLE_ID, VEHICLE_TYPE } from "../../fixtures/trips.fixtures";
import { apiFetch } from "../../support/apiFetch";

/**
 * Pure API-level checks for trip completion, now fully mocked (no real
 * backend, no login). The spec makes no UI assertions, but it still needs a
 * `page` so `page.route()` can intercept the calls — see
 * e2e/support/apiFetch.ts for why raw calls go through `page.evaluate(fetch)`
 * rather than `page.request`. A `page.goto()` first establishes that browser
 * context (and installs the admin session mock) before any fetch is issued.
 */

test.describe("Trips (mocked API)", () => {
  test.beforeEach(async ({ page }) => {
    await installTripsMocks(page);
    // Any page under the mocked app establishes the browser context that
    // page.route() watches; the page's own render isn't under test here.
    await page.goto("/admin/loans");
  });

  async function deleteTrip(page: import("@playwright/test").Page, id: number) {
    await apiFetch(page, `/api/trip-bookings?id=${id}`, { method: "DELETE" }).catch(() => {});
  }

  const costItems = [
    { label: "Diesel", amount: 400 },
    { label: "Driver", amount: 300 },
  ];

  test("completes a booking into one unified trip record", async ({ page }) => {
    const customerName = "Mocked unified booking";
    let bookingId: number | undefined;

    try {
      const create = await apiFetch(page, "/api/trip-bookings", {
        method: "POST",
        data: {
          customer_name: customerName,
          from_location: "Hyderabad",
          to_location: "Bengaluru",
          start_date: "2026-12-20",
          vehicle_type: VEHICLE_TYPE,
          vehicle_id: VEHICLE_ID,
          quoted_amount: 1500,
          advance_amount: 500,
        },
      });
      expect(create.ok, await create.text()).toBeTruthy();
      bookingId = ((await create.json()) as { data: { booking: { id: number } } }).data.booking.id;

      const complete = await apiFetch(page, "/api/trip-bookings/complete", {
        method: "POST",
        data: {
          booking_id: bookingId,
          vehicle_id: VEHICLE_ID,
          trip_type: "external_user",
          customer_name: customerName,
          from_location: "Hyderabad",
          to_location: "Bengaluru",
          start_date: "2026-12-20",
          cost_items: costItems,
          amount_received: 1500,
        },
      });
      expect(complete.ok, await complete.text()).toBeTruthy();

      const completed = ((await complete.json()) as { data: { booking: Record<string, unknown> } }).data
        .booking;
      expect(completed.status).toBe("completed");
      expect(Number(completed.total_cost)).toBe(700);
      expect(Number(completed.amount_received)).toBe(1500);
      expect(completed.completed_at).toBeTruthy();
    } finally {
      if (bookingId) await deleteTrip(page, bookingId);
    }
  });

  test("records an unplanned completed trip in the unified Trips table", async ({ page }) => {
    const customerName = "Mocked direct trip";
    let tripId: number | undefined;

    try {
      const complete = await apiFetch(page, "/api/trip-bookings/complete", {
        method: "POST",
        data: {
          vehicle_id: VEHICLE_ID,
          trip_type: "company_oncall",
          customer_name: customerName,
          from_location: "Hyderabad",
          to_location: "Vijayawada",
          start_date: "2026-12-21",
          cost_items: costItems,
          amount_received: 1800,
        },
      });
      expect(complete.ok, await complete.text()).toBeTruthy();

      const trip = ((await complete.json()) as { data: { booking: Record<string, unknown> } }).data.booking;
      tripId = trip.id as number;
      expect(trip.status).toBe("completed");
      expect(trip.vehicle_id).toBe(VEHICLE_ID);
      expect(trip.advance_amount).toBe(0);
      expect(Number(trip.total_cost)).toBe(700);
      expect(Number(trip.amount_received)).toBe(1800);
    } finally {
      if (tripId) await deleteTrip(page, tripId);
    }
  });
});
