import { test, expect } from "@playwright/test";
import { installSmokeMocks } from "../../fixtures/smoke.fixtures";

/**
 * Phone chrome (Flutter-style): the dashboard's own header, the navigation
 * drawer, the app bar's back arrow — and none of it on desktop. Fully mocked.
 */
test.describe("phone layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await installSmokeMocks(page);
  });

  test("dashboard opens the drawer and the drawer navigates", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByTestId("mobile-dashboard")).toBeVisible();
    await expect(page.getByText("Quick Access")).toBeVisible();
    await expect(page.getByTestId("admin-mobile-topbar")).toHaveCount(0);

    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByTestId("admin-mobile-menu");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await drawer.getByRole("link", { name: "Loans" }).click();
    await expect(page).toHaveURL(/\/admin\/loans$/);
    await expect(drawer).toBeHidden();
    await expect(page.getByTestId("admin-mobile-topbar").getByRole("heading")).toHaveText("Loans");
  });

  test("Escape closes the drawer", async ({ page }) => {
    await page.goto("/admin/loans");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByTestId("admin-mobile-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("admin-mobile-menu")).toBeHidden();
  });

  test("Tab stays inside the open drawer", async ({ page }) => {
    await page.goto("/admin/loans");
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByTestId("admin-mobile-menu");
    await expect(drawer).toBeVisible();

    // More presses than the drawer has controls, both directions: focus must
    // never land on the page behind it.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
  });

  test("a dashboard tile opens its module", async ({ page }) => {
    await page.goto("/admin");
    await page.getByTestId("mobile-dashboard-module-loans").click();
    await expect(page).toHaveURL(/\/admin\/loans$/);
  });

  test("a list page's back arrow returns to the dashboard", async ({ page }) => {
    await page.goto("/admin/clients");
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("mobile-dashboard")).toBeVisible();
  });
});

test("desktop has no phone chrome", async ({ page }) => {
  await installSmokeMocks(page);
  await page.goto("/admin");
  await expect(page.getByTestId("admin-dashboard-card-loans")).toBeVisible();
  await expect(page.getByTestId("mobile-dashboard")).toHaveCount(0);
  await expect(page.getByTestId("admin-mobile-topbar")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0);
});
