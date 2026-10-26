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
  { name: "fundings", path: "/admin/fundings", mocks: installFundingsMocks },
  { name: "fundings_detail", path: `/admin/fundings/${FUNDING_ID}`, mocks: installFundingsMocks },
  { name: "salaries", path: "/admin/salaries", mocks: installSalaryMocks },
  { name: "trip-bookings", path: "/admin/trip-bookings", mocks: installTripsMocks },
  { name: "entities", path: "/admin/entities", mocks: installEntitiesMocks },
  ...[
    "/admin/vehicles",
    "/admin/drivers",
    "/admin/attendance",
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
    const isDesktop = testInfo.project.name === "desktop";
    test.skip(isDesktop && !!shot.mobileOnly, "phone-only state");

    // Fixed clock so greetings, "today" and relative dates match between runs.
    await page.clock.setFixedTime(new Date("2026-06-15T10:00:00+05:30"));
    await shot.mocks(page);
    await page.goto(shot.path, { waitUntil: "networkidle" });
    await shot.prepare?.(page);
    // The phone layout mounts right after hydration (useIsMobile).
    await page.waitForTimeout(800);

    if (isDesktop) {
      await expect(page).toHaveScreenshot(`${shot.name}.png`);
    } else {
      await page.screenshot({
        path: `visual-snapshots/${label}/${testInfo.project.name}/${shot.name}.png`,
        animations: "disabled",
      });
    }
  });
}
