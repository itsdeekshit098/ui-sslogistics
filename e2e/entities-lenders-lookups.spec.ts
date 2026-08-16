import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { testLabel } from "./support/run-id";
import { humanFill } from "./support/human";

let api: APIRequestContext;

test.beforeAll(async ({ baseURL }) => {
  api = await request.newContext({ baseURL, storageState: "e2e/.auth/admin.json" });
});
test.afterAll(async () => {
  await api.dispose();
});

test.describe("Entities (Firms & Owners)", () => {
  test("creates a person, blocks deletion while a loan references it, then deletes cleanly", async ({
    page,
  }) => {
    const name = testLabel("Entity");

    await page.goto("/admin/entities");
    await page.getByTestId("entities-add-btn").click();
    await expect(page.getByRole("heading", { name: "New Firm or Person" })).toBeVisible();

    await humanFill(page.getByLabel("Name"), name);
    await page.getByLabel("Type").click();
    await page.getByRole("option", { name: "Person" }).click();
    await page.getByLabel("Relationship").click();
    await page.getByRole("option", { name: "External" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "New Firm or Person" })).toBeHidden();

    await humanFill(page.getByTestId("entities-search-input"), name);
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();

    // Reference it from a loan (via API — loan creation itself is loans.spec.ts's job).
    const entityRes = await api.get(`/api/entities?search=${encodeURIComponent(name)}`);
    const entityId = (await entityRes.json()).data.data[0].id;
    const lenderName = testLabel("BlockingLender");
    const lenderRes = await api.post("/api/lenders", {
      data: { name: lenderName, lender_kind: "INSTITUTION" },
    });
    const lenderId = (await lenderRes.json()).data.lender.id;
    const loanRes = await api.post("/api/loans", {
      data: {
        loan_type: "PERSONAL",
        borrower_entity_id: entityId,
        lender_id: lenderId,
        principal_amount: 50000,
        start_date: "2026-01-01",
        first_emi_date: "2026-02-01",
        emi_amount: 5000,
        emi_day_of_month: 1,
        total_installments: 1,
      },
    });
    const loanId = (await loanRes.json()).data.loan.id;

    await page.reload();
    await humanFill(page.getByTestId("entities-search-input"), name);
    await page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "Delete Entity" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("loan(s)");

    // Unblock and delete for real.
    await api.delete(`/api/loans?id=${loanId}`);
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Delete Entity" })).toBeHidden();

    await api.delete(`/api/lenders?id=${lenderId}`);
  });
});

test.describe("Lenders", () => {
  test("creates a lender, blocks deletion while a funding references it, then deletes cleanly", async () => {
    // Lenders have no standalone admin page — they're managed from within
    // Loans → New Loan / Add Funding → "Add new lender" (covered as part of
    // the loan-creation flow in loans.spec.ts). Created via API here so this
    // test can focus on the part with real logic: the delete guard.
    const name = testLabel("Lender");

    const lenderRes = await api.post("/api/lenders", {
      data: { name, lender_kind: "INSTITUTION" },
    });
    expect(lenderRes.ok(), await lenderRes.text()).toBeTruthy();
    const lenderId = (await lenderRes.json()).data.lender.id;

    const fundingRes = await api.post("/api/fundings", {
      data: {
        direction: "BORROWED",
        funder_id: lenderId,
        amount: 10000,
        start_date: "2026-01-01",
        interest_mode: "PERCENT",
        roi: 1,
        roi_basis: "MONTHLY",
      },
    });
    const fundingId = (await fundingRes.json()).data.funding.id;

    const blockedDelete = await api.delete(`/api/lenders?id=${lenderId}`);
    expect(blockedDelete.status()).toBe(400);

    await api.delete(`/api/fundings?id=${fundingId}`);
    const okDelete = await api.delete(`/api/lenders?id=${lenderId}`);
    expect(okDelete.ok(), await okDelete.text()).toBeTruthy();
  });
});

test.describe("Dropdown lists (Settings)", () => {
  test("adds, deactivates, and deletes a loan-type option", async ({ page }) => {
    const label = testLabel("LoanType");

    await page.goto("/admin/settings");
    await expect(page.getByText("Dropdown Lists")).toBeVisible();
    await page.getByRole("tab", { name: "Loan Types" }).click();

    await humanFill(page.getByPlaceholder("Add an option…"), label);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText(label, { exact: true })).toBeVisible();

    const row = page.locator("li", { hasText: label });
    await row.getByRole("button", { name: "Turn off" }).click();
    await expect(row.getByRole("button", { name: "Turn on" })).toBeVisible();

    await row.getByRole("button", { name: `Delete ${label}` }).click();
    await expect(page.getByRole("heading", { name: "Delete Option" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(label, { exact: true })).toBeHidden();
  });
});
