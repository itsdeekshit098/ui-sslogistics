import type { Locator, Page } from "@playwright/test";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The accessible name the calendar gives a day: "Monday, 15 June 2026". */
function dayName(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  return `${weekday}, ${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * Choose a date in the library's DatePicker the way a person does: open it,
 * page to the right month, click the day. `field` is the picker's button (find
 * it by its label), and `iso` is "YYYY-MM-DD".
 */
export async function pickDate(page: Page, field: Locator, iso: string): Promise<void> {
  await field.click();
  const calendar = page.locator('[data-ui="calendar"]');
  await calendar.waitFor();

  const [y, m] = iso.split("-").map(Number);
  const shown = (await calendar.getByRole("grid").getAttribute("aria-label")) ?? "";
  const [monthName, year] = shown.split(" ");
  const diff = (y - Number(year)) * 12 + (m - 1 - MONTHS.indexOf(monthName));
  const step = calendar.getByRole("button", { name: diff < 0 ? "Previous month" : "Next month" });
  for (let i = 0; i < Math.abs(diff); i++) await step.click();

  await calendar.getByRole("button", { name: dayName(iso), exact: true }).click();
}

/**
 * Choose a month in the library's MonthPicker: open it, page to the right
 * year, click the month. `field` is the picker's button; `month` is "YYYY-MM".
 * The twelve month buttons are in calendar order, so the month is picked by
 * position rather than by its (locale-dependent) short name.
 */
export async function pickMonth(page: Page, field: Locator, month: string): Promise<void> {
  await field.click();
  const [y, m] = month.split("-").map(Number);
  const shown = await page.getByRole("group", { name: /^Months of \d{4}$/ }).getAttribute("aria-label");
  const diff = y - Number(shown!.slice(-4));
  const step = page.getByRole("button", { name: diff < 0 ? "Previous year" : "Next year" });
  for (let i = 0; i < Math.abs(diff); i++) await step.click();
  await page.getByRole("group", { name: `Months of ${y}` }).getByRole("button").nth(m - 1).click();
}
