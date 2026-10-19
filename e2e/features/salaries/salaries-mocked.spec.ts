import { expect, test } from "@playwright/test";
import {
  DRIVER_ID,
  INITIAL_MONTH,
  installSalaryMocks,
  UNSALARIED_DRIVER_ID,
} from "../../fixtures/salaries.fixtures";
import {
  assertApiCallsAreMocked,
  openDriver,
  openSalaryPage,
  visibleDriverName,
} from "../../pages/salariesPage";

test.describe("Salaries page with fully mocked API responses", () => {
  test("renders totals and rows; filters by driver/place; clears search", async ({ page }) => {
    const mocks = await openSalaryPage(page);
    await expect(page.getByText("Monthly Salaries")).toBeVisible();
    await expect(page.getByText("Attendance Cuts")).toBeVisible();
    await expect(page.getByText("Net Payable")).toBeVisible();
    await expect(visibleDriverName(page, "Meena Iyer")).toBeVisible();

    const search = page.getByTestId("salaries-search-input");
    await search.fill("coimbatore");
    await expect(visibleDriverName(page, "Meena Iyer")).toBeVisible();
    await expect(visibleDriverName(page, "Ravi Kumar")).toHaveCount(0);
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(visibleDriverName(page, "Ravi Kumar")).toBeVisible();

    await search.fill("no matching driver");
    await expect(page.getByText("No drivers found")).toBeVisible();
    assertApiCallsAreMocked(mocks);
  });

  test("changes month using previous/next controls and the month picker", async ({ page }) => {
    const mocks = await openSalaryPage(page);
    await expect(page.getByText("June 2026", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(page.getByText("May 2026", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(page.getByText("June 2026", { exact: true })).toBeVisible();

    await page.getByTestId("salaries-month-input").fill("2026-08");
    await page.getByTestId("salaries-month-input").dispatchEvent("change");
    await expect(page.getByText("August 2026", { exact: true })).toBeVisible();

    expect(mocks.payloads.map(({ url }) => url)).toContain(
      "/api/driver-salaries?month=2026-05",
    );
    expect(mocks.payloads.map(({ url }) => url)).toContain(
      "/api/driver-salaries?month=2026-08",
    );
    assertApiCallsAreMocked(mocks);
  });

  test("shows the empty sheet state", async ({ page }) => {
    await installSalaryMocks(page, { emptySheet: true });
    await page.goto("/admin/salaries");
    await expect(page.getByText("No drivers yet")).toBeVisible();
    await expect(page.getByTestId("salaries-export-btn")).toBeDisabled();
  });

  test("renders the mobile salary list and supports mobile search and month navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const mocks = await openSalaryPage(page);
    await expect(page.getByTestId(`salary-row-${DRIVER_ID}`)).toBeVisible();
    await expect(page.getByText("Net payable", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(page.getByText("May 2026", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(page.getByText("Jun 2026", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Search drivers" }).click();
    await page.getByTestId("salaries-search-input").fill("coimbatore");
    await expect(visibleDriverName(page, "Meena Iyer")).toBeVisible();
    await expect(visibleDriverName(page, "Ravi Kumar")).toHaveCount(0);
    assertApiCallsAreMocked(mocks);
  });

  test("opens driver details and shows pay calculation, attendance, and salary history", async ({
    page,
  }) => {
    const mocks = await openSalaryPage(page);
    await openDriver(page);
    await expect(page.getByText("Net pay", { exact: true })).toBeVisible();
    await expect(page.getByText("How this was calculated")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByText("Monthly salary", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText(/2 unpaid days of 30/)).toBeVisible();
    await expect(page.getByText("From January 2026")).toBeVisible();
    expect(mocks.payloads.some(({ url }) => url ===
      `/api/driver-salaries/${DRIVER_ID}?month=${INITIAL_MONTH}`)).toBe(true);
    assertApiCallsAreMocked(mocks);
  });

  test("sets the first salary for an unsalaried driver and refreshes the page", async ({ page }) => {
    const mocks = await openSalaryPage(page);
    await openDriver(page, "Meena Iyer");
    await expect(page.getByText("Salary not set")).toBeVisible();
    await expect(page.getByRole("button", { name: /mark paid/i })).toBeDisabled();
    await page.getByLabel("Salary (₹ per month)").fill("25000");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Net pay", { exact: true })).toBeVisible();

    const rateWrite = mocks.payloads.find(
      ({ url, method }) => url === `/api/driver-salaries/${UNSALARIED_DRIVER_ID}/rates` && method === "POST",
    );
    expect(rateWrite?.body).toMatchObject({
      monthly_salary: 25000,
      effective_month: INITIAL_MONTH,
    });
    assertApiCallsAreMocked(mocks);
  });

  test("changes the salary from an effective month and retains a visible rate history", async ({
    page,
  }) => {
    const mocks = await openSalaryPage(page);
    await openDriver(page);
    await page.getByRole("button", { name: "Change" }).click();
    await page.getByLabel("Salary (₹ per month)").fill("32000");
    await page.getByLabel("From month").fill("2026-05");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("From May 2026")).toBeVisible();
    const write = mocks.payloads.find(
      ({ url, method }) => url === `/api/driver-salaries/${DRIVER_ID}/rates` && method === "POST",
    );
    expect(write?.body).toMatchObject({ monthly_salary: 32000, effective_month: "2026-05" });
    assertApiCallsAreMocked(mocks);
  });

  test("rejects blank salary and zero advance or deduction amounts without API writes", async ({
    page,
  }) => {
    const mocks = await openSalaryPage(page);
    await openDriver(page);

    await page.getByRole("button", { name: "Change" }).click();
    await page.getByLabel("Salary (₹ per month)").fill("");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("alert").getByText("Enter the monthly salary")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add advance", exact: true })
      .click();
    await page.getByLabel("Amount (₹)").fill("0");
    await page.getByRole("button", { name: "Record advance" }).click();
    await expect(page.getByRole("alert").getByText("Enter an amount greater than zero")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add deduction", exact: true })
      .click();
    await page.getByLabel("Amount (₹)").fill("0");
    await page.getByRole("button", { name: "Record deduction" }).click();
    await expect(page.getByRole("alert").getByText("Enter an amount greater than zero")).toBeVisible();
    expect(mocks.payloads.some(({ method, url }) =>
      method === "POST" && (/\/rates$/.test(url) || /\/entries$/.test(url)),
    )).toBe(false);
    assertApiCallsAreMocked(mocks);
  });

  test("records an advance and a deduction, then reverses a ledger entry", async ({ page }) => {
    const mocks = await openSalaryPage(page);
    await openDriver(page);

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add advance", exact: true })
      .click();
    await page.getByLabel("Amount (₹)").fill("1500");
    await page.getByLabel("Note (optional)").fill("Mock family advance");
    await page.getByRole("button", { name: "Record advance" }).click();
    await expect(page.getByText(/Advance · ₹1,500/)).toBeVisible();

    await page.getByRole("button", { name: "Add deduction" }).click();
    await page.getByLabel("Amount (₹)").fill("500");
    await page.getByLabel("Note (optional)").fill("Mock repair deduction");
    await page.getByRole("button", { name: "Record deduction" }).click();
    await expect(page.getByText(/Deduction · ₹500/)).toBeVisible();

    const reverseButton = page.getByRole("button", { name: "Reverse" }).first();
    await reverseButton.click();
    await page.getByRole("button", { name: "Reverse", exact: true }).first().click();
    await expect(page.getByText("Reversed")).toBeVisible();
    await expect(page.getByText("Reversal")).toBeVisible();

    expect(mocks.payloads.filter(({ method, url }) => method === "POST" && /\/entries$/.test(url))).toHaveLength(2);
    expect(mocks.payloads.some(({ method, url }) => method === "POST" && /\/entries\/\d+\/reverse$/.test(url))).toBe(true);
    assertApiCallsAreMocked(mocks);
  });

  test("quick-adds an advance from the driver row and refreshes totals", async ({ page }) => {
    const mocks = await openSalaryPage(page);
    await page
      .getByRole("button", { name: /Ravi Kumar/ })
      .getByRole("button", { name: "Add advance" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Amount (₹)").fill("750");
    await page.getByLabel("Note (optional)").fill("Quick mocked advance");
    await page.getByRole("button", { name: "Record advance" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("₹3,750").first()).toBeVisible();

    const write = mocks.payloads.find(
      ({ url, method }) => url === `/api/driver-salaries/${DRIVER_ID}/entries` && method === "POST",
    );
    expect(write?.body).toMatchObject({
      entry_type: "ADVANCE",
      amount: 750,
      period_month: INITIAL_MONTH,
      description: "Quick mocked advance",
    });
    assertApiCallsAreMocked(mocks);
  });

  test("validates empty settle amount; settles short-paid, shows carry-forward, and undoes it", async ({
    page,
  }) => {
    const mocks = await openSalaryPage(page);
    await openDriver(page);
    await page.getByRole("button", { name: "Mark paid" }).click();
    await page.getByLabel(/Amount actually paid/).fill("");
    await page.getByRole("button", { name: "Confirm paid" }).click();
    await expect(page.getByRole("alert").getByText("Enter the amount actually paid")).toBeVisible();
    expect(mocks.payloads.some(({ url }) => url === `/api/driver-salaries/${DRIVER_ID}/settle`)).toBe(false);

    await page.getByLabel(/Amount actually paid/).fill("27000");
    await expect(page.getByText(/paying ₹1,000 less than owed/i)).toBeVisible();
    await page.getByLabel("Note (optional)").fill("Mock short payment");
    await page.getByRole("button", { name: "Confirm paid" }).click();
    await expect(page.getByText("✓ Paid")).toBeVisible();
    await expect(page.getByText(/Paid ₹1,000 short/)).toBeVisible();
    await expect(page.getByText(/Mock short payment/)).toBeVisible();

    await page.getByRole("button", { name: "Undo settlement" }).click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByRole("button", { name: "Mark paid" })).toBeVisible();
    const settleWrite = mocks.payloads.find(
      ({ url, method }) => url === `/api/driver-salaries/${DRIVER_ID}/settle` && method === "POST",
    );
    expect(settleWrite?.body).toMatchObject({
      period_month: INITIAL_MONTH,
      amount_paid: 27000,
      note: "Mock short payment",
    });
    expect(mocks.payloads.some(({ method, url }) =>
      method === "DELETE" && /^\/api\/driver-salaries\/101\/settle\/\d+$/.test(url),
    )).toBe(true);
    assertApiCallsAreMocked(mocks);
  });

  test("previews overpayment carry-forward and disables list quick-add after settlement", async ({
    page,
  }) => {
    const mocks = await openSalaryPage(page);
    await openDriver(page);
    await page.getByRole("button", { name: "Mark paid" }).click();
    await page.getByLabel(/Amount actually paid/).fill("29000");
    await expect(page.getByText(/paying ₹1,000 more than owed/i)).toBeVisible();
    await page.getByRole("button", { name: "Confirm paid" }).click();
    await expect(page.getByText(/Overpaid by ₹1,000/)).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(
      page
        .getByRole("button", { name: /Ravi Kumar/ })
        .getByRole("button", { name: "Add advance" }),
    ).toBeDisabled();
    assertApiCallsAreMocked(mocks);
  });

  test("exports the selected month as a mocked CSV download", async ({ page }) => {
    const mocks = await openSalaryPage(page);
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("salaries-export-btn").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`driver_salaries_${INITIAL_MONTH}.csv`);
    expect(mocks.payloads.some(({ method, url }) =>
      method === "GET" && url === `/api/driver-salaries/export?month=${INITIAL_MONTH}`,
    )).toBe(true);
    assertApiCallsAreMocked(mocks);
  });

  test("shows and retries a salary-sheet load error", async ({ page }) => {
    const mocks = await installSalaryMocks(page, { failListOnce: true });
    await page.goto("/admin/salaries");
    await expect(page.getByText("Couldn't load salaries")).toBeVisible();
    await expect(page.getByText("Mock salary sheet error")).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "Salaries", exact: true })).toBeVisible();
    assertApiCallsAreMocked(mocks);
  });

  test("shows and retries a driver-detail load error", async ({ page }) => {
    const mocks = await openSalaryPage(page, { failDetailOnce: true });
    await visibleDriverName(page, "Ravi Kumar").click();
    await expect(page.getByText("Mock driver detail error")).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "Ravi Kumar" })).toBeVisible();
    assertApiCallsAreMocked(mocks);
  });

  test("surfaces mutation and export failures without reporting success", async ({ page }) => {
    const mocks = await openSalaryPage(page, {
      failNextMutation: "/entries",
      failExport: true,
    });
    await openDriver(page);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add advance", exact: true })
      .click();
    await page.getByLabel("Amount (₹)").fill("400");
    await page.getByRole("button", { name: "Record advance" }).click();
    await expect(page.getByRole("alert").getByText("Mock save rejected")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByTestId("salaries-export-btn").click();
    await expect(page.getByText("Couldn't download the export. Try again.")).toBeVisible();
    assertApiCallsAreMocked(mocks);
  });
});
