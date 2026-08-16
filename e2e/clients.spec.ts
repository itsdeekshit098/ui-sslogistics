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

test.describe("New client — validation", () => {
  test("blocks submission with the company name empty", async ({ page }) => {
    await page.goto("/admin/clients");
    await page.getByTestId("clients-add-btn").click();
    await expect(page.getByRole("heading", { name: "New Client" })).toBeVisible();

    // Default mode is COMPANY, so "Company Name" is the field under test.
    await page.getByRole("dialog").getByRole("button", { name: "Save Client" }).click();
    await expect(page.getByText("Company name is required")).toBeVisible();
  });
});

test.describe("Client lifecycle", () => {
  let clientName: string;
  let clientId: number;

  test.beforeEach(async ({ page }) => {
    clientName = testLabel("Client");
    await page.goto("/admin/clients");
    await page.getByTestId("clients-add-btn").click();
    await humanFill(page.getByLabel("Company Name"), clientName);
    await page.getByRole("dialog").getByRole("button", { name: "Save Client" }).click();
    await expect(page.getByRole("heading", { name: "New Client" })).toBeHidden();

    const res = await page.request.get(`/api/clients?search=${encodeURIComponent(clientName)}`);
    const body = await res.json();
    clientId = body.data.data[0].id;
  });

  test.afterEach(async () => {
    await api.delete(`/api/clients?id=${clientId}`).catch(() => {});
  });

  test("bills, partially pays, reverses the bill, and re-settles to an advance", async ({
    page,
  }) => {
    await page.goto(`/admin/clients/${clientId}`);

    // The empty statement's own EmptyState renders a second "Add Bill" button
    // alongside the page header's — the header's is first in DOM order.
    await page.getByRole("button", { name: "Add Bill" }).first().click();
    await expect(page.getByRole("heading", { name: "Add Bill" })).toBeVisible();
    await humanFill(page.getByLabel("Amount"), "25000");
    await humanFill(page.getByLabel("Date", { exact: true }), "2026-08-01");
    await page.getByRole("dialog").getByRole("button", { name: "Add Bill" }).click();
    await expect(page.getByRole("heading", { name: "Add Bill" })).toBeHidden();
    await expect(page.getByText("₹25,000").first()).toBeVisible(); // Total Billed

    await page.getByRole("button", { name: "Record Payment" }).click();
    await humanFill(page.getByLabel("Amount"), "10000");
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
  });

  test("adds a contact and a describe-by-type vehicle deployment", async ({ page }) => {
    await page.goto(`/admin/clients/${clientId}`);
    await page.getByRole("tab", { name: "Contacts" }).click();

    const contactName = testLabel("Contact");
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
  });

  test("blocks deletion while a balance is outstanding, then deletes once settled", async ({
    page,
  }) => {
    await api.post(`/api/clients/${clientId}/entries`, {
      data: { entry_type: "BILL", direction: "DEBIT", amount: 5000, entry_date: "2026-08-01" },
    });

    await page.goto("/admin/clients");
    await humanFill(page.getByTestId("clients-search-input"), clientName);
    // Clients-list rows are click-to-navigate, so DataTable renders them with
    // role="button" rather than role="row" (unlike e.g. the entities list,
    // which isn't row-clickable).
    await page
      .getByRole("button", { name: new RegExp(clientName) })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByRole("heading", { name: "Delete Client" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("not settled");

    const entries = await (await api.get(`/api/clients/${clientId}/entries`)).json();
    const bill = entries.data.data.find((e: { entry_type: string }) => e.entry_type === "BILL");
    await api.post(`/api/clients/${clientId}/entries/${bill.id}/reverse`, { data: {} });

    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Delete Client" })).toBeHidden();
    clientId = -1; // already deleted — skip afterEach's own delete attempt
  });
});
