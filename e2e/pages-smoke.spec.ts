import { test, expect } from "@playwright/test";

/**
 * Every admin page in the money-module surface, rendered once, checked for
 * console errors. Deliberately shallow — this is the "did anything actually
 * break" tripwire, not a substitute for the deeper per-module specs.
 */
const PAGES = [
  "/admin/loans",
  "/admin/clients",
  "/admin/entities",
  "/admin/bank-accounts",
  "/admin/activity-log",
  "/admin/vehicle-owners",
  "/admin/settings",
];

for (const path of PAGES) {
  test(`${path} renders with no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.ok(), `${path} responded ${response?.status()}`).toBeTruthy();

    // Every one of these pages renders a top-level heading or page title once
    // its client-side fetch resolves; waiting for that rules out a blank
    // shell being mistaken for a successful render.
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });

    expect(errors, `console errors on ${path}:\n${errors.join("\n")}`).toEqual([]);
  });
}
