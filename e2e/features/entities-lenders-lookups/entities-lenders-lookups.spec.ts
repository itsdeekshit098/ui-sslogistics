import { test, expect } from "@playwright/test";
import { humanFill } from "../../support/human";
import { apiFetch } from "../../support/apiFetch";
import { EntitiesPage } from "../../pages/entitiesPage";
import { installEntitiesMocks } from "../../fixtures/entities.fixtures";

test.describe("Entities (Firms & Owners)", () => {
  test("creates a person, blocks deletion while a loan references it, then deletes cleanly", async ({
    page,
  }) => {
    await installEntitiesMocks(page);
    const name = "Mock Entity";
    const entities = new EntitiesPage(page);

    await entities.createPerson(name);

    await entities.searchFor(name);
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();

    // Reference it from a loan (via API — loan creation itself is loans.spec.ts's job).
    const entityRes = await apiFetch(page, `/api/entities?search=${encodeURIComponent(name)}`);
    const entityId = (await entityRes.json()).data.data[0].id;
    const lenderRes = await apiFetch(page, "/api/lenders", {
      method: "POST",
      data: { name: "Mock Blocking Lender", lender_kind: "INSTITUTION" },
    });
    const lenderId = (await lenderRes.json()).data.lender.id;
    const loanRes = await apiFetch(page, "/api/loans", {
      method: "POST",
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
    await entities.searchFor(name);
    await page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "Delete Entity" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("loan(s)");

    // Unblock and delete for real.
    await apiFetch(page, `/api/loans?id=${loanId}`, { method: "DELETE" });
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Delete Entity" })).toBeHidden();

    await apiFetch(page, `/api/lenders?id=${lenderId}`, { method: "DELETE" });
  });
});

test.describe("Lenders", () => {
  // Lenders have no standalone admin page — they're managed from within
  // Loans → New Loan / Add Funding → "Add new lender" (covered as part of
  // the loan-creation flow in loans.spec.ts). This test focuses purely on
  // the delete guard's logic, so it skips page interaction entirely, aside
  // from one page.goto() to install the mock and give apiFetch() a document
  // to run fetch() in (see e2e/support/apiFetch.ts).
  test("creates a lender, blocks deletion while a funding references it, then deletes cleanly", async ({
    page,
  }) => {
    await installEntitiesMocks(page);
    await page.goto("/admin/entities");

    const name = "Mock Lender";

    const lenderRes = await apiFetch(page, "/api/lenders", {
      method: "POST",
      data: { name, lender_kind: "INSTITUTION" },
    });
    expect(lenderRes.ok, await lenderRes.text()).toBeTruthy();
    const lenderId = (await lenderRes.json()).data.lender.id;

    const fundingRes = await apiFetch(page, "/api/fundings", {
      method: "POST",
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

    const blockedDelete = await apiFetch(page, `/api/lenders?id=${lenderId}`, { method: "DELETE" });
    expect(blockedDelete.status).toBe(400);

    await apiFetch(page, `/api/fundings?id=${fundingId}`, { method: "DELETE" });
    const okDelete = await apiFetch(page, `/api/lenders?id=${lenderId}`, { method: "DELETE" });
    expect(okDelete.ok, await okDelete.text()).toBeTruthy();
  });
});

test.describe("Dropdown lists (Settings)", () => {
  test("adds, deactivates, and deletes a loan-type option", async ({ page }) => {
    await installEntitiesMocks(page);
    const label = "Mock Loan Type";

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
