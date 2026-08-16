import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { testLabel } from "./support/run-id";
import { humanFill } from "./support/human";

/**
 * Real login, real Supabase-backed dev database — see e2e/README.md before
 * editing this file, especially the single-session note.
 *
 * Setup data (a borrower entity + a lender) is created via the API rather
 * than through the UI: it's not what these tests are about, and doing it
 * through two more typeahead "add new" side-modals would just add brittle
 * surface area between each test and the thing it's actually checking.
 */

let api: APIRequestContext;
let entityId: number;
let entityName: string;
let lenderId: number;
let lenderName: string;

test.beforeAll(async ({ baseURL }) => {
  api = await request.newContext({ baseURL, storageState: "e2e/.auth/admin.json" });

  entityName = testLabel("Borrower");
  const entityRes = await api.post("/api/entities", {
    data: { name: entityName, entity_kind: "PERSON", relationship: "EXTERNAL" },
  });
  expect(entityRes.ok(), await entityRes.text()).toBeTruthy();
  entityId = (await entityRes.json()).data.entity.id;

  lenderName = testLabel("Lender");
  const lenderRes = await api.post("/api/lenders", {
    data: { name: lenderName, lender_kind: "INSTITUTION" },
  });
  expect(lenderRes.ok(), await lenderRes.text()).toBeTruthy();
  lenderId = (await lenderRes.json()).data.lender.id;
});

test.afterAll(async () => {
  // Loans referencing these are deleted by each test's own cleanup; this is
  // the fixture data's own teardown, in reverse creation order.
  await api.delete(`/api/lenders?id=${lenderId}`);
  await api.delete(`/api/entities?id=${entityId}`);
  await api.dispose();
});

async function openNewLoanModal(page: import("@playwright/test").Page) {
  await page.goto("/admin/loans");
  await page.getByTestId("loans-primary-action-btn").click();
  await expect(page.getByRole("heading", { name: "New Loan" })).toBeVisible();
}

async function pickTypeahead(
  page: import("@playwright/test").Page,
  label: string,
  searchText: string,
  optionName: string,
) {
  const field = page.getByLabel(label);
  await field.click();
  await humanFill(field, searchText);
  await page.getByRole("option", { name: optionName }).click();
}

async function fillValidLoanTerms(page: import("@playwright/test").Page) {
  await pickTypeahead(page, "Loan Type", "Vehicle Loan", "Vehicle Loan");
  await pickTypeahead(page, "In Whose Name", entityName, entityName);
  await pickTypeahead(page, "Lender", lenderName, lenderName);
  await humanFill(page.getByLabel("Principal Amount"), "500000");
  await humanFill(page.getByLabel("Start Date"), "2026-01-01");
  await humanFill(page.getByLabel("First EMI Date"), "2026-02-05");
  await humanFill(page.getByLabel("EMI Amount"), "45000");
  await humanFill(page.getByLabel("EMI Day of Month"), "5");
  await humanFill(page.getByLabel("Total Installments"), "6");
}

test.describe("Loans list", () => {
  test("renders stat cards and the status/overdue filters", async ({ page }) => {
    await page.goto("/admin/loans");
    await expect(page.getByRole("heading", { name: "Loans", exact: true })).toBeVisible();
    await expect(page.getByText("Total Outstanding")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Active" })).toBeVisible();
    await expect(page.getByTestId("loans-overdue-toggle")).toBeVisible();
  });
});

test.describe("New loan — validation", () => {
  test("blocks submission with every required field empty", async ({ page }) => {
    await openNewLoanModal(page);
    await page.getByRole("button", { name: "Save Loan" }).click();

    await expect(page.getByText("Loan type is required")).toBeVisible();
    await expect(page.getByText("Borrower is required")).toBeVisible();
    await expect(page.getByText("Enter the principal amount")).toBeVisible();
    await expect(page.getByText("Start date is required")).toBeVisible();
    await expect(page.getByText("First EMI date is required")).toBeVisible();
    await expect(page.getByText("Enter the EMI amount")).toBeVisible();
    await expect(page.getByText("EMI day must be between 1 and 31")).toBeVisible();
    await expect(page.getByText("Enter the number of installments")).toBeVisible();
  });

  test("rejects a first EMI date before the start date", async ({ page }) => {
    await openNewLoanModal(page);
    await pickTypeahead(page, "Loan Type", "Vehicle Loan", "Vehicle Loan");
    await pickTypeahead(page, "In Whose Name", entityName, entityName);
    await humanFill(page.getByLabel("Principal Amount"), "100000");
    await humanFill(page.getByLabel("Start Date"), "2026-03-01");
    await humanFill(page.getByLabel("First EMI Date"), "2026-01-01");
    await humanFill(page.getByLabel("EMI Amount"), "10000");
    await humanFill(page.getByLabel("EMI Day of Month"), "5");
    await humanFill(page.getByLabel("Total Installments"), "6");
    await page.getByRole("button", { name: "Save Loan" }).click();

    await expect(page.getByText("First EMI cannot be before the start date")).toBeVisible();
  });

  test("rejects an EMI day outside 1–31", async ({ page }) => {
    await openNewLoanModal(page);
    await humanFill(page.getByLabel("EMI Day of Month"), "45");
    await page.getByRole("button", { name: "Save Loan" }).click();
    await expect(page.getByText("EMI day must be between 1 and 31")).toBeVisible();
  });
});

test.describe("New loan — creates and renders", () => {
  test("creates a loan and its schedule, then shows both on the detail page", async ({
    page,
  }) => {
    await openNewLoanModal(page);
    await fillValidLoanTerms(page);
    const loanNumber = testLabel("Loan");
    await humanFill(page.getByLabel("Loan Number"), loanNumber);
    await page.getByRole("button", { name: "Save Loan" }).click();

    // Modal closes and the new loan is on the list.
    await expect(page.getByRole("heading", { name: "New Loan" })).toBeHidden();
    await page.getByText(loanNumber).click();

    // Detail page: 6 installments at ₹45,000 each, EMI stat card matches.
    await expect(page.getByText("₹45,000").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Schedule" })).toBeVisible();
    await expect(page.getByRole("row", { name: /1.*5 Feb 2026/ })).toBeVisible();

    // Clean up via API — this test's own record, not global teardown's job.
    const res = await page.request.get("/api/loans?page_size=50");
    const body = await res.json();
    const created = body.data.data.find((l: { loan_number: string }) => l.loan_number === loanNumber);
    expect(created).toBeTruthy();
    await page.request.delete(`/api/loans?id=${created.id}`);
  });
});

test.describe("Loan detail — payments and reversal", () => {
  let loanId: number;
  let loanNumber: string;
  let installmentId: number;

  test.beforeEach(async () => {
    loanNumber = testLabel("PayLoan");
    const res = await api.post("/api/loans", {
      data: {
        loan_type: "PERSONAL",
        borrower_entity_id: entityId,
        lender_id: lenderId,
        loan_number: loanNumber,
        principal_amount: 200000,
        start_date: "2026-01-01",
        first_emi_date: "2026-02-05",
        emi_amount: 20000,
        emi_day_of_month: 5,
        total_installments: 4,
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    loanId = (await res.json()).data.loan.id;

    const detail = await (await api.get(`/api/loans/${loanId}`)).json();
    installmentId = detail.data.installments[0].id;
  });

  test.afterEach(async () => {
    await api.delete(`/api/loans?id=${loanId}`).catch(() => {});
  });

  test("marking an installment paid updates the balance, and it can be reversed", async ({
    page,
  }) => {
    await page.goto(`/admin/loans/${loanId}`);

    // Schedule totals 4 × ₹20,000 = ₹80,000 — not the ₹2,00,000 principal,
    // which funds this loan but isn't itself what's tracked as owed.
    await expect(page.getByText("₹80,000").first()).toBeVisible();

    await page.getByRole("button", { name: "Mark Paid" }).first().click();
    await expect(page.getByRole("heading", { name: "Mark EMI Paid" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Record" }).click();
    await expect(page.getByRole("heading", { name: "Mark EMI Paid" })).toBeHidden();

    await expect(page.getByText("₹60,000").first()).toBeVisible(); // outstanding after ₹20,000 paid

    await page.getByRole("tab", { name: "Payments" }).click();
    await page.getByRole("button", { name: "Reverse" }).click();
    await expect(page.getByRole("heading", { name: "Reverse Payment" })).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Reverse", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Reverse Payment" })).toBeHidden();

    await expect(page.getByText("₹80,000").first()).toBeVisible(); // back to full outstanding
  });

  test(
    "a schedule-shaping edit after a reversed payment rebuilds that installment — getProtectedInstallmentIds excludes reversed pairs",
    async () => {
      // Pay installment 1, then reverse it — the loan is now genuinely
      // unpaid, but loan_payments still has two rows referencing it (the
      // original payment and its reversal, both carrying installment_id).
      await api.post(`/api/loans/${loanId}/payments`, {
        data: { payment_type: "EMI", installment_id: installmentId, amount: 20000, paid_on: "2026-02-04" },
      });
      const payments = await (await api.get(`/api/loans/${loanId}`)).json();
      const paymentId = payments.data.payments[0].id;
      await api.post(`/api/loans/${loanId}/payments/${paymentId}/reverse`, { data: {} });

      // Bump the EMI amount — a schedule-shaping edit that should rebuild
      // every unpaid installment, including #1.
      await api.put("/api/loans", { data: { id: loanId, emi_amount: 99000 } });

      const after = await (await api.get(`/api/loans/${loanId}`)).json();
      const first = after.data.installments[0];
      expect(first.amount_due).toBe(99000);
    },
  );
});
