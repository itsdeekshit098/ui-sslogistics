import { test, expect } from "@playwright/test";
import { humanFill } from "../../support/human";
import { apiFetch } from "../../support/apiFetch";
import { LoansPage } from "../../pages/loansPage";
import {
  ENTITY_NAME,
  LENDER_NAME,
  installLoansMocks,
  type MockApi,
} from "../../fixtures/loans.fixtures";

/**
 * Fully mocked — see e2e/README.md. page.route() intercepts every /api/**
 * call with an in-memory fixture store (e2e/fixtures/loans.fixtures.ts); no
 * login, no real Supabase, no record cleanup needed.
 */

let mocks: MockApi;

test.beforeEach(async ({ page }) => {
  mocks = await installLoansMocks(page);
});

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
    const loans = new LoansPage(page);
    await loans.openNewLoanModal();
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
    const loans = new LoansPage(page);
    await loans.openNewLoanModal();
    await loans.pickTypeahead("Loan Type", "Vehicle Loan", "Vehicle Loan");
    await loans.pickTypeahead("In Whose Name", ENTITY_NAME, ENTITY_NAME);
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
    const loans = new LoansPage(page);
    await loans.openNewLoanModal();
    await humanFill(page.getByLabel("EMI Day of Month"), "45");
    await page.getByRole("button", { name: "Save Loan" }).click();
    await expect(page.getByText("EMI day must be between 1 and 31")).toBeVisible();
  });
});

test.describe("New loan — creates and renders", () => {
  test("creates a loan and its schedule, then shows both on the detail page", async ({
    page,
  }) => {
    const loans = new LoansPage(page);
    await loans.openNewLoanModal();
    await loans.fillValidLoanTerms(ENTITY_NAME, LENDER_NAME);
    const loanNumber = "Mock Loan 001";
    await humanFill(page.getByLabel("Loan Number"), loanNumber);
    await page.getByRole("button", { name: "Save Loan" }).click();

    // Modal closes and the new loan is on the list.
    await expect(page.getByRole("heading", { name: "New Loan" })).toBeHidden();
    await page.getByText(loanNumber).click();

    // Detail page: 6 installments at ₹45,000 each, EMI stat card matches.
    await expect(page.getByText("₹45,000").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Schedule" })).toBeVisible();
    await expect(page.getByRole("row", { name: /1.*5 Feb 2026/ })).toBeVisible();

    const createWrite = mocks.payloads.find(
      ({ url, method }) => url === "/api/loans" && method === "POST",
    );
    expect(createWrite?.body).toMatchObject({ loan_number: loanNumber });
  });
});

test.describe("Loan detail — payments and reversal", () => {
  let loanId: number;

  test.beforeEach(async ({ page }) => {
    // A page must be navigated first so page.route() mocks are installed
    // and there's a document context for fetch() to run in.
    await page.goto("/admin/loans");
    const res = await apiFetch(page, "/api/loans", {
      method: "POST",
      data: {
        loan_type: "PERSONAL",
        borrower_entity_id: 501,
        lender_id: 601,
        loan_number: "Mock Pay Loan",
        principal_amount: 200000,
        start_date: "2026-01-01",
        first_emi_date: "2026-02-05",
        emi_amount: 20000,
        emi_day_of_month: 5,
        total_installments: 4,
      },
    });
    loanId = (await res.json()).data.loan.id;
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
    async ({ page }) => {
      // Pay installment 1, then reverse it — the loan is now genuinely
      // unpaid, but loan_payments still has two rows referencing it (the
      // original payment and its reversal, both carrying installment_id).
      const detail = await (await apiFetch(page, `/api/loans/${loanId}`)).json();
      const installmentId = detail.data.installments[0].id;

      await apiFetch(page, `/api/loans/${loanId}/payments`, {
        method: "POST",
        data: { payment_type: "EMI", installment_id: installmentId, amount: 20000, paid_on: "2026-02-04" },
      });
      const payments = await (await apiFetch(page, `/api/loans/${loanId}`)).json();
      const paymentId = payments.data.payments[0].id;
      await apiFetch(page, `/api/loans/${loanId}/payments/${paymentId}/reverse`, { method: "POST", data: {} });

      // Bump the EMI amount — a schedule-shaping edit that should rebuild
      // every unpaid installment, including #1.
      await apiFetch(page, "/api/loans", { method: "PUT", data: { id: loanId, emi_amount: 99000 } });

      const after = await (await apiFetch(page, `/api/loans/${loanId}`)).json();
      const first = after.data.installments[0];
      expect(first.amount_due).toBe(99000);
    },
  );
});
