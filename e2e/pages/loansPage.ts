import { expect, type Page } from "@playwright/test";
import { humanFill } from "../support/human";

/**
 * Page object for /admin/loans (the Loans list, the New Loan modal, and the
 * typeahead fields shared with Private Fundings on the same page).
 */
export class LoansPage {
  constructor(private readonly page: Page) {}

  async openNewLoanModal(): Promise<void> {
    await this.page.goto("/admin/loans");
    await this.page.getByTestId("loans-primary-action-btn").click();
    await expect(this.page.getByRole("heading", { name: "New Loan" })).toBeVisible();
  }

  async pickTypeahead(label: string, searchText: string, optionName: string): Promise<void> {
    const field = this.page.getByLabel(label);
    await field.click();
    await humanFill(field, searchText);
    await this.page.getByRole("option", { name: optionName }).click();
  }

  async fillValidLoanTerms(entityName: string, lenderName: string): Promise<void> {
    await this.pickTypeahead("Loan Type", "Vehicle Loan", "Vehicle Loan");
    await this.pickTypeahead("In Whose Name", entityName, entityName);
    await this.pickTypeahead("Lender", lenderName, lenderName);
    await humanFill(this.page.getByLabel("Principal Amount"), "500000");
    await humanFill(this.page.getByLabel("Start Date"), "2026-01-01");
    await humanFill(this.page.getByLabel("First EMI Date"), "2026-02-05");
    await humanFill(this.page.getByLabel("EMI Amount"), "45000");
    await humanFill(this.page.getByLabel("EMI Day of Month"), "5");
    await humanFill(this.page.getByLabel("Total Installments"), "6");
  }
}
