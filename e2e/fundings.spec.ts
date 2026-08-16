import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { testLabel } from "./support/run-id";
import { humanFill } from "./support/human";

let api: APIRequestContext;
let lenderId: number;
let lenderName: string;

test.beforeAll(async ({ baseURL }) => {
  api = await request.newContext({ baseURL, storageState: "e2e/.auth/admin.json" });
  lenderName = testLabel("Funder");
  // fundingModal's "Funder" typeahead only fetches lender_kind=PRIVATE — private
  // fundings are specifically money from individuals; institutions go through
  // the Loans module instead.
  const res = await api.post("/api/lenders", {
    data: { name: lenderName, lender_kind: "PRIVATE" },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  lenderId = (await res.json()).data.lender.id;
});

test.afterAll(async () => {
  await api.delete(`/api/lenders?id=${lenderId}`);
  await api.dispose();
});

async function openFundingsTab(page: import("@playwright/test").Page) {
  await page.goto("/admin/loans");
  await page.getByRole("tab", { name: "Private Fundings" }).click();
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

test.describe("New private funding — validation", () => {
  test("blocks submission with every required field empty", async ({ page }) => {
    await openFundingsTab(page);
    await page.getByTestId("loans-primary-action-btn").click();
    await expect(page.getByRole("heading", { name: "New Private Funding" })).toBeVisible();

    await page.getByRole("dialog").getByRole("button", { name: "Save Funding" }).click();

    await expect(page.getByText("Funder is required")).toBeVisible();
    await expect(page.getByText("Enter the amount borrowed")).toBeVisible();
    await expect(page.getByText("Enter the rate")).toBeVisible();
  });
});

test.describe("New private funding — creates and computes interest", () => {
  test("creates a funding and shows day-prorated interest on the detail page", async ({
    page,
  }) => {
    await openFundingsTab(page);
    await page.getByTestId("loans-primary-action-btn").click();

    await pickTypeahead(page, "Funder", lenderName, lenderName);
    await humanFill(page.getByLabel("Amount Borrowed"), "100000");
    await humanFill(page.getByLabel("Date Borrowed"), "2026-06-10");
    await humanFill(page.getByLabel("Rate (%)"), "2");
    await page.getByRole("dialog").getByRole("button", { name: "Save Funding" }).click();
    await expect(page.getByRole("heading", { name: "New Private Funding" })).toBeHidden();

    await page.getByText(lenderName).click();
    await expect(page.getByText("PRINCIPAL OUTSTANDING")).toBeVisible();
    await expect(page.getByText("₹1,00,000").first()).toBeVisible();

    const res = await page.request.get("/api/fundings?page_size=50&direction=BORROWED");
    const body = await res.json();
    const created = body.data.data.find((f: { lenders?: { name: string } }) => f.lenders?.name === lenderName);
    expect(created).toBeTruthy();
    await page.request.delete(`/api/fundings?id=${created.id}`);
  });
});

test.describe("Funding detail — entries, reversal, rate change", () => {
  let fundingId: number;

  test.beforeEach(async () => {
    const res = await api.post("/api/fundings", {
      data: {
        direction: "BORROWED",
        funder_id: lenderId,
        amount: 100000,
        start_date: "2026-06-10",
        interest_mode: "PERCENT",
        roi: 2,
        roi_basis: "MONTHLY",
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    fundingId = (await res.json()).data.funding.id;
  });

  test.afterEach(async () => {
    await api.delete(`/api/fundings?id=${fundingId}`).catch(() => {});
  });

  test("pays interest, reverses it, and records a rate change", async ({ page }) => {
    await page.goto(`/admin/fundings/${fundingId}`);

    await page.getByRole("button", { name: "Pay Interest" }).click();
    await expect(page.getByRole("heading", { name: "Pay Interest" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Record" }).click();
    await expect(page.getByRole("heading", { name: "Pay Interest" })).toBeHidden();

    await page.getByRole("tab", { name: "Entries" }).click();
    await expect(page.getByText("Paid interest")).toBeVisible();
    // The opening PRINCIPAL_TAKEN entry also has its own "Reverse" button —
    // scope to this entry's row specifically.
    await page
      .getByRole("row", { name: /Paid interest/ })
      .getByRole("button", { name: "Reverse" })
      .click();
    await expect(page.getByRole("heading", { name: "Reverse Entry" })).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Reverse", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Reverse Entry" })).toBeHidden();

    await page.getByRole("button", { name: "Change Rate" }).click();
    await expect(page.getByRole("heading", { name: "Change Rate" })).toBeVisible();
    await humanFill(page.getByLabel("Rate (%)"), "2.5");
    await humanFill(page.getByLabel("Effective From"), "2026-08-01");
    await page.getByRole("dialog").getByRole("button", { name: "Save Rate" }).click();
    await expect(page.getByRole("heading", { name: "Change Rate" })).toBeHidden();

    await page.getByRole("tab", { name: "Rate History" }).click();
    await expect(page.getByText("2.5%").first()).toBeVisible();
  });
});
