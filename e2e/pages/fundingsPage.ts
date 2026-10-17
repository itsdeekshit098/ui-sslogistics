import { type Page } from "@playwright/test";
import { humanFill } from "../support/human";

/** Page object for the Private Fundings tab on /admin/loans. */
export class FundingsPage {
  constructor(private readonly page: Page) {}

  async openFundingsTab(): Promise<void> {
    await this.page.goto("/admin/loans");
    await this.page.getByRole("tab", { name: "Private Fundings" }).click();
  }

  async pickTypeahead(label: string, searchText: string, optionName: string): Promise<void> {
    const field = this.page.getByLabel(label);
    await field.click();
    await humanFill(field, searchText);
    await this.page.getByRole("option", { name: optionName }).click();
  }
}
