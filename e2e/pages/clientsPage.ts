import { expect, type Page } from "@playwright/test";
import { humanFill } from "../support/human";
import { installClientsMocks, type MockApi } from "../fixtures/clients.fixtures";

/** Page object for /admin/clients and its client-detail page. */
export class ClientsPage {
  constructor(private readonly page: Page) {}

  async openNewClientModal(): Promise<void> {
    await this.page.goto("/admin/clients");
    // The page's own button is "Add Client"; the modal it opens is titled
    // "New Client" (vs. "Edit Client" when editing an existing one).
    await this.page.getByTestId("clients-add-btn").click();
    await expect(this.page.getByRole("heading", { name: "New Client" })).toBeVisible();
  }

  /** Default mode is COMPANY, so "Company Name" is the field under test. */
  async createClient(clientName: string): Promise<void> {
    await this.openNewClientModal();
    await humanFill(this.page.getByLabel("Company Name"), clientName);
    await this.page.getByRole("dialog").getByRole("button", { name: "Save Client" }).click();
    await expect(this.page.getByRole("heading", { name: "New Client" })).toBeHidden();
  }
}

export async function openClientsPage(page: Page): Promise<MockApi> {
  const mocks = await installClientsMocks(page);
  await page.goto("/admin/clients");
  await expect(page.getByTestId("clients-add-btn")).toBeVisible();
  return mocks;
}

export function assertApiCallsAreMocked(mocks: MockApi): void {
  expect(mocks.requests.length).toBeGreaterThan(0);
  for (const request of mocks.requests) {
    expect(new URL(request.url()).pathname).toMatch(/^\/api\//);
  }
}
