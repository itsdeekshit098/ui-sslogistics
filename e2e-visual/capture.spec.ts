import { test, expect, type Page } from "@playwright/test";
import { apiFetch } from "../e2e/support/apiFetch";
import { installSmokeMocks } from "../e2e/fixtures/smoke.fixtures";
import { installLoansMocks } from "../e2e/fixtures/loans.fixtures";
import { installClientsMocks, CLIENT_ID } from "../e2e/fixtures/clients.fixtures";
import { installFundingsMocks, FUNDING_ID } from "../e2e/fixtures/fundings.fixtures";
import { installSalaryMocks } from "../e2e/fixtures/salaries.fixtures";
import { installTripsMocks } from "../e2e/fixtures/trips.fixtures";
import { installEntitiesMocks } from "../e2e/fixtures/entities.fixtures";

type Shot = {
  name: string;
  path: string;
  mocks: (page: Page) => Promise<unknown>;
  /** Runs after the page has loaded, before the screenshot. */
  prepare?: (page: Page) => Promise<void>;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
  /**
   * Crop the comparison to a region. Use it when the component under test is
   * small and the rest of the page reflows by a sub-pixel between runs.
   */
  clip?: { x: number; y: number; width: number; height: number };
};

async function seedLoan(page: Page) {
  await apiFetch(page, "/api/loans", {
    method: "POST",
    data: {
      loan_type: "PERSONAL",
      borrower_entity_id: 501,
      lender_id: 601,
      loan_number: "Visual Loan",
      principal_amount: 200000,
      start_date: "2026-01-01",
      first_emi_date: "2026-02-05",
      emi_amount: 20000,
      emi_day_of_month: 5,
      total_installments: 12,
    },
  });
}


/**
 * Opens the "new loan" form: a button on desktop, the floating button on
 * phones. The phone button only exists once the list has a row, so seed one.
 */
async function openLoanModal(page: Page) {
  await seedLoan(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-testid^="loans-primary-action-btn"]:visible').first().click();
  await page.waitForTimeout(500);
}

const attendanceDrivers = [
  { driver_id: 1, name: "Ravi Kumar", place: "Chennai", shifts: ["A", "B", "C"], status: null, shift_count: 3 },
  { driver_id: 2, name: "Meena Iyer", place: "Coimbatore", shifts: ["A"], status: null, shift_count: 3 },
  { driver_id: 3, name: "Arun Das", place: "Chennai", shifts: [], status: "ABSENT", shift_count: 2 },
  { driver_id: 4, name: "Suresh Babu", place: "Hosur", shifts: [], status: null, shift_count: 3 },
  { driver_id: 5, name: "Lakshmi N", place: null, shifts: [], status: "LEAVE", shift_count: 3 },
].map((d) => ({ ...d, is_active: true, pay_type: "MONTHLY", previous: null }));

async function installAttendanceMocks(page: Page) {
  await installSmokeMocks(page);
  await page.route("**/api/driver-attendance**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/driver-attendance" || url.searchParams.has("month")) {
      return route.fallback();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { date: "2026-06-15", today: "2026-06-15", editable: true, drivers: attendanceDrivers },
      }),
    });
  });
}

const smoke = (path: string): Shot => ({
  name: path.replace(/^\/admin\/?/, "").replace(/\//g, "_") || "dashboard",
  path,
  mocks: installSmokeMocks,
});

const SHOTS: Shot[] = [
  smoke("/admin"),
  {
    name: "dashboard_menu-open",
    path: "/admin",
    mocks: installSmokeMocks,
    mobileOnly: true,
    prepare: async (page) => {
      await page.getByTestId("admin-mobile-avatar-btn").click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "loans",
    path: "/admin/loans",
    mocks: installLoansMocks,
    prepare: async (page) => {
      await seedLoan(page);
      await page.reload({ waitUntil: "networkidle" });
    },
  },
  {
    name: "loans_form",
    path: "/admin/loans",
    mocks: installLoansMocks,
    mobileOnly: true,
    prepare: async (page) => {
      await seedLoan(page);
      await page.reload({ waitUntil: "networkidle" });
      await page.getByTestId("loans-primary-action-btn-fab").click();
      await page.waitForTimeout(500);
    },
  },
  // ── Open overlays: the shared components that sit above the page ──────────
  {
    name: "loans_modal-form",
    path: "/admin/loans",
    mocks: installLoansMocks,
    prepare: openLoanModal,
  },
  {
    name: "loans_modal-select-open",
    path: "/admin/loans",
    mocks: installLoansMocks,
    prepare: async (page) => {
      await openLoanModal(page);
      await page.locator("#loan-mandate").click();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "loans_modal-combobox-open",
    path: "/admin/loans",
    mocks: installLoansMocks,
    prepare: async (page) => {
      await openLoanModal(page);
      await page.locator("#loan-borrower").click();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "loans_filter-drawer",
    path: "/admin/loans",
    mocks: installLoansMocks,
    mobileOnly: true,
    prepare: async (page) => {
      await page.getByRole("button", { name: "Filters" }).click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "loans_row-actions-sheet",
    path: "/admin/loans",
    mocks: installLoansMocks,
    mobileOnly: true,
    prepare: async (page) => {
      await seedLoan(page);
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Actions" }).first().click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "loans_confirm-delete",
    path: "/admin/loans",
    mocks: installLoansMocks,
    mobileOnly: true,
    prepare: async (page) => {
      await seedLoan(page);
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Actions" }).first().click();
      await page.getByRole("menuitem", { name: /delete/i }).click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "sidebar_collapsed-tooltip",
    path: "/admin/clients",
    mocks: installClientsMocks,
    desktopOnly: true,
    // Just the sidebar and its tooltip: the page beside it reflows when the
    // sidebar collapses, and its right-aligned button lands on a different
    // sub-pixel from run to run (even against the committed code).
    clip: { x: 0, y: 0, width: 320, height: 900 },
    prepare: async (page) => {
      await page.getByTestId("sidebar-toggle-btn").click();
      // Let the sidebar finish animating its width before hovering.
      await page.waitForTimeout(600);
      await page.locator('a[href="/admin/loans"]').hover();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "loans_detail",
    path: "/admin/loans",
    mocks: installLoansMocks,
    prepare: async (page) => {
      await seedLoan(page);
      await page.goto("/admin/loans/9001", { waitUntil: "networkidle" });
    },
  },
  { name: "clients", path: "/admin/clients", mocks: installClientsMocks },
  { name: "clients_detail", path: `/admin/clients/${CLIENT_ID}`, mocks: installClientsMocks },
  {
    name: "fundings_detail",
    path: `/admin/fundings/${FUNDING_ID}`,
    mocks: (page) => installFundingsMocks(page, { seedFunding: true }),
  },
  { name: "salaries", path: "/admin/salaries", mocks: installSalaryMocks },
  { name: "trip-bookings", path: "/admin/trip-bookings", mocks: installTripsMocks },
  { name: "entities", path: "/admin/entities", mocks: installEntitiesMocks },
  { name: "attendance", path: "/admin/attendance", mocks: installAttendanceMocks },
  ...[
    "/admin/vehicles",
    "/admin/drivers",
    "/admin/diesel-records",
    "/admin/repair-records",
    "/admin/warranty",
    "/admin/technicians",
    "/admin/vehicle-owners",
    "/admin/external-trips",
    "/admin/bank-accounts",
    "/admin/activity-log",
    "/admin/sessions",
    "/admin/settings",
    "/admin/reports",
    "/admin/trip-sheets",
  ].map(smoke),
];

const label = process.env.VISUAL_LABEL ?? "before";

for (const shot of SHOTS) {
  test(shot.name, async ({ page }, testInfo) => {
    const isDesktop = testInfo.project.name.startsWith("desktop");
    test.skip(isDesktop && !!shot.mobileOnly, "phone-only state");
    test.skip(!isDesktop && !!shot.desktopOnly, "desktop-only state");

    // Fixed clock so greetings, "today" and relative dates match between runs.
    await page.clock.setFixedTime(new Date("2026-06-15T10:00:00+05:30"));
    await shot.mocks(page);
    await page.goto(shot.path, { waitUntil: "networkidle" });
    await shot.prepare?.(page);
    // The phone layout mounts right after hydration (useIsMobile).
    await page.waitForTimeout(800);

    // Phone shots are also copied to before/after for side-by-side review
    // against the Flutter app (see .claude/rules/phone-layout.md).
    if (!isDesktop) {
      await page.screenshot({
        path: `visual-snapshots/${label}/${testInfo.project.name}/${shot.name}.png`,
        animations: "disabled",
      });
    }
    // Every project is compared with its own baseline; any pixel fails.
    await expect(page).toHaveScreenshot(`${shot.name}.png`, shot.clip ? { clip: shot.clip } : {});
  });
}
