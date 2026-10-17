import { expect, type Page } from "@playwright/test";
import { installSalaryMocks, type MockApi, type MockOptions } from "../fixtures/salaries.fixtures";

/** Page-interaction helpers for the mocked /admin/salaries suite. */

export async function openSalaryPage(page: Page, options?: MockOptions): Promise<MockApi> {
  const mocks = await installSalaryMocks(page, options);
  await page.goto("/admin/salaries");
  await expect(page.getByRole("heading", { name: "Salaries", exact: true })).toBeVisible();
  await expect(visibleDriverName(page, "Ravi Kumar")).toBeVisible();
  return mocks;
}

export function visibleDriverName(page: Page, name: string) {
  return page.getByRole("button", { name: new RegExp(name) }).first();
}

export async function openDriver(page: Page, name = "Ravi Kumar"): Promise<void> {
  await visibleDriverName(page, name).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

export function assertApiCallsAreMocked(mocks: MockApi): void {
  expect(mocks.requests.length).toBeGreaterThan(0);
  for (const request of mocks.requests) {
    expect(new URL(request.url()).origin).toBe("http://localhost:3100");
    expect(new URL(request.url()).pathname).toMatch(/^\/api\//);
  }
}
