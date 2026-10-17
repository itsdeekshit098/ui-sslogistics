import { type Page } from "@playwright/test";

/**
 * Broad catch-all mock for the "did anything break" smoke suite
 * (pages-smoke.spec.ts). These 7 admin pages aren't tested for business
 * logic here — only that they render without crashing now that there's no
 * real backend to answer their on-load fetches. Every GET gets a shape
 * generic enough that a DataTable/list component won't throw on `.map` of
 * undefined; paginated list endpoints get `{ data: [], total: 0 }` nested
 * under `data` (matching the real `apiSuccess({ data, total })` envelope),
 * everything else gets `{}`.
 */

export function successfulJson(data: unknown, message = "Success") {
  return { success: true, data, message };
}

const PAGED_LIST_PATHS = new Set([
  "/api/loans",
  "/api/clients",
  "/api/entities",
  "/api/bank-accounts",
  "/api/vehicles",
  "/api/vehicle-owners",
]);

const PLAIN_ARRAY_LIST_PATHS = new Set(["/api/lenders", "/api/lookups"]);

export async function installSmokeMocks(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/auth/session" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successfulJson({
            id: "mock-user",
            email: "mock@example.test",
            // superadmin so /admin/settings' superadmin-only sub-fetches
            // (maintenance mode, app version) succeed too.
            role: "superadmin",
            displayName: "Mock Admin",
          }),
        ),
      });
    }

    if (path === "/api/activity-log" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successfulJson({ data: [], total: 0, page: 1, limit: 30, totalPages: 0 }),
        ),
      });
    }

    // Both are polled by a real browser EventSource (the maintenance banner
    // and the notification bell) — an EventSource aborts with a console
    // error if the response isn't actually text/event-stream, so these two
    // need the real content type even in a mock.
    if (path === "/api/system/maintenance-stream" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: ${JSON.stringify({ maintenanceMode: false, message: null })}\n\n`,
      });
    }

    if (path === "/api/notifications/stream" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "",
      });
    }

    if (path === "/api/admin/settings/maintenance" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successfulJson({ maintenanceMode: false, message: null }),
        ),
      });
    }

    if (path === "/api/admin/settings/app-version" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successfulJson({ minAndroidVersionCode: null, message: null }),
        ),
      });
    }

    if (path === "/api/loans/calendar" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ data: [] })),
      });
    }

    if (PAGED_LIST_PATHS.has(path) && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ data: [], total: 0 })),
      });
    }

    if (PLAIN_ARRAY_LIST_PATHS.has(path) && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ data: [] })),
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
}
