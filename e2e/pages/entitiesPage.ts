import { expect, type Page } from "@playwright/test";
import { humanFill } from "../support/human";

/** Page object for /admin/entities (Firms & Owners). */
export class EntitiesPage {
  constructor(private readonly page: Page) {}

  async openNewEntityModal(): Promise<void> {
    await this.page.goto("/admin/entities");
    await this.page.getByTestId("entities-add-btn").click();
    await expect(this.page.getByRole("heading", { name: "New Firm or Person" })).toBeVisible();
  }

  async createPerson(name: string): Promise<void> {
    await this.openNewEntityModal();
    await humanFill(this.page.getByLabel("Name"), name);
    await this.page.getByLabel("Type").click();
    await this.page.getByRole("option", { name: "Person" }).click();
    await this.page.getByLabel("Relationship").click();
    await this.page.getByRole("option", { name: "External" }).click();
    await this.page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(this.page.getByRole("heading", { name: "New Firm or Person" })).toBeHidden();
  }

  async searchFor(name: string): Promise<void> {
    await humanFill(this.page.getByTestId("entities-search-input"), name);
  }
}
