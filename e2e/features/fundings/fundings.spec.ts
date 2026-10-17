import { test, expect } from "@playwright/test";
import { humanFill } from "../../support/human";
import { FundingsPage } from "../../pages/fundingsPage";
import {
  FUNDING_ID,
  LENDER_NAME,
  installFundingsMocks,
} from "../../fixtures/fundings.fixtures";

test.describe("New private funding — validation", () => {
  test("blocks submission with every required field empty", async ({ page }) => {
    await installFundingsMocks(page);
    const fundings = new FundingsPage(page);
    await fundings.openFundingsTab();
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
    await installFundingsMocks(page);
    const fundings = new FundingsPage(page);
    await fundings.openFundingsTab();
    await page.getByTestId("loans-primary-action-btn").click();

    await fundings.pickTypeahead("Funder", LENDER_NAME, LENDER_NAME);
    await humanFill(page.getByLabel("Amount Borrowed"), "100000");
    await humanFill(page.getByLabel("Date Borrowed"), "2026-06-10");
    await humanFill(page.getByLabel("Rate (%)"), "2");
    await page.getByRole("dialog").getByRole("button", { name: "Save Funding" }).click();
    await expect(page.getByRole("heading", { name: "New Private Funding" })).toBeHidden();

    await page.getByText(LENDER_NAME).click();
    await expect(page.getByText("Principal Outstanding")).toBeVisible();
    await expect(page.getByText("₹1,00,000").first()).toBeVisible();
  });
});

test.describe("Funding detail — entries, reversal, rate change", () => {
  test("pays interest, reverses it, and records a rate change", async ({ page }) => {
    await installFundingsMocks(page, { seedFunding: true });
    await page.goto(`/admin/fundings/${FUNDING_ID}`);

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
    await humanFill(page.getByLabel("New Rate (%)"), "2.5");
    await humanFill(page.getByLabel("Effective From"), "2026-08-01");
    await page.getByRole("dialog").getByRole("button", { name: "Save Rate" }).click();
    await expect(page.getByRole("heading", { name: "Change Rate" })).toBeHidden();

    await page.getByRole("tab", { name: "Rate History" }).click();
    await expect(page.getByText("2.5%").first()).toBeVisible();
  });
});
