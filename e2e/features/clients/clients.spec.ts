import { expect, test } from "@playwright/test";
import { humanFill } from "../../support/human";
import { apiFetch } from "../../support/apiFetch";
import { ClientsPage, assertApiCallsAreMocked, openClientsPage } from "../../pages/clientsPage";
import { CLIENT_ID, CLIENT_NAME, installClientsMocks } from "../../fixtures/clients.fixtures";

test.describe("New client — validation", () => {
  test("blocks submission with the company name empty", async ({ page }) => {
    await installClientsMocks(page);
    const clients = new ClientsPage(page);
    await clients.openNewClientModal();

    // Default mode is COMPANY, so "Company Name" is the field under test.
    await page.getByRole("dialog").getByRole("button", { name: "Save Client" }).click();
    await expect(page.getByText("Company name is required")).toBeVisible();
  });
});

test.describe("Client lifecycle", () => {
  test("bills, partially pays, reverses the bill, and re-settles to an advance", async ({
    page,
  }) => {
    const mocks = await installClientsMocks(page);
    await page.goto(`/admin/clients/${CLIENT_ID}`);

    // The empty statement's own EmptyState renders a second "Add Bill" button
    // alongside the page header's — the header's is first in DOM order.
    await page.getByRole("button", { name: "Add Bill" }).first().click();
    await expect(page.getByRole("heading", { name: "Add Bill" })).toBeVisible();
    await humanFill(page.getByLabel("Amount (₹)"), "25000");
    await humanFill(page.getByLabel("Date", { exact: true }), "2026-08-01");
    await page.getByRole("dialog").getByRole("button", { name: "Add Bill" }).click();
    await expect(page.getByRole("heading", { name: "Add Bill" })).toBeHidden();
    await expect(page.getByText("₹25,000").first()).toBeVisible(); // Total Billed

    await page.getByRole("button", { name: "Record Payment" }).click();
    await humanFill(page.getByLabel("Amount (₹)"), "10000");
    await humanFill(page.getByLabel("Date", { exact: true }), "2026-08-10");
    await page.getByRole("dialog").getByRole("button", { name: "Record Payment" }).click();
    await expect(page.getByRole("heading", { name: "Record Payment" })).toBeHidden();

    // Reverse the bill while a payment already sits against it — the real
    // arithmetic case, not just "reverse the only entry".
    await page
      .getByRole("row", { name: /BILL/ })
      .getByRole("button", { name: "Reverse entry" })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Reverse", exact: true }).click();

    // Both the bill and its reversal net out and drop from the balance,
    // leaving the ₹10,000 payment as a pure advance.
    await expect(page.getByText("₹10,000").first()).toBeVisible(); // Advance Held
    assertApiCallsAreMocked(mocks);
  });

  test("adds a contact and a describe-by-type vehicle deployment", async ({ page }) => {
    const mocks = await installClientsMocks(page);
    await page.goto(`/admin/clients/${CLIENT_ID}`);
    await page.getByRole("tab", { name: "Contacts" }).click();

    const contactName = "Mock Contact";
    await page.getByRole("button", { name: "Add Contact" }).click();
    await expect(page.getByRole("heading", { name: "Add Contact" })).toBeVisible();
    await humanFill(page.getByLabel("Name"), contactName);
    await page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Add Contact" })).toBeHidden();
    await expect(page.getByText(contactName)).toBeVisible();

    await page.getByRole("tab", { name: "Vehicles" }).click();
    await page.getByRole("button", { name: "Add Vehicle" }).click();
    await expect(page.getByRole("heading", { name: "Add Vehicle" })).toBeVisible();
    await page.getByRole("button", { name: "Describe by type" }).click();
    await page.getByLabel("Vehicle Type").click();
    await page.getByRole("option", { name: "Truck" }).click();
    await humanFill(page.getByLabel("How Many"), "1");
    await page.getByLabel("Truck Type").click();
    await page.getByRole("option", { name: "Medium Commercial Vehicle (MCV)" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Add Vehicle" })).toBeHidden();
    await expect(page.getByText("1 × Truck").first()).toBeVisible();
    assertApiCallsAreMocked(mocks);
  });

  test("blocks deletion while a balance is outstanding, then deletes once settled", async ({
    page,
  }) => {
    const mocks = await installClientsMocks(page);
    // A page.goto() first establishes the browser context apiFetch() needs
    // (see e2e/support/apiFetch.ts for why page.request can't be used here).
    await page.goto("/admin/clients");

    // Seed an outstanding bill directly via the mocked API, the same way the
    // original spec seeded it through the real backend.
    const createRes = await apiFetch(page, `/api/clients/${CLIENT_ID}/entries`, {
      method: "POST",
      data: { entry_type: "BILL", direction: "DEBIT", amount: 5000, entry_date: "2026-08-01" },
    });
    expect(createRes.ok).toBe(true);
    await humanFill(page.getByTestId("clients-search-input"), CLIENT_NAME);
    // Clients-list rows are click-to-navigate, so DataTable renders them with
    // role="button" rather than role="row" (unlike e.g. the entities list,
    // which isn't row-clickable).
    await page
      .getByRole("button", { name: new RegExp(CLIENT_NAME) })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByRole("heading", { name: "Delete Client" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("not settled");

    const entriesRes = await apiFetch(page, `/api/clients/${CLIENT_ID}/entries`);
    const entries = await entriesRes.json();
    const bill = entries.data.data.find((e: { entry_type: string }) => e.entry_type === "BILL");
    const reverseRes = await apiFetch(page, `/api/clients/${CLIENT_ID}/entries/${bill.id}/reverse`, {
      method: "POST",
      data: {},
    });
    expect(reverseRes.ok).toBe(true);

    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Delete Client" })).toBeHidden();
    assertApiCallsAreMocked(mocks);
  });
});

test.describe("Clients page smoke", () => {
  test("loads the clients list", async ({ page }) => {
    const mocks = await openClientsPage(page);
    await expect(page.getByText(CLIENT_NAME)).toBeVisible();
    assertApiCallsAreMocked(mocks);
  });
});
