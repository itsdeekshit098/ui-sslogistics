import type { Locator, Page } from "@playwright/test";

/**
 * Typing into an `<input type="date">` is order-dependent: a day-first browser
 * (India, UK) reads "16112025" as 16 Nov 2025, a month-first one (the default
 * on a Linux CI runner) reads the same keys as garbage. The order comes from
 * the operating system, NOT from Playwright's `locale` option or `--lang` —
 * measured on Chromium: neither changes it — so a test that hard-codes either
 * order passes on one machine and fails on the other.
 *
 * So ask the browser instead. `dateFieldOrder` types a probe date into a
 * throwaway date input and reads back which order produced it; `typeDate`
 * then types any ISO date in that order, the way a person would.
 */

export type DateFieldOrder = "dmy" | "mdy";

// Click inside the first segment of the field (x: 12), as a user would.
const FIRST_SEGMENT = { x: 12, y: 10 };

// 13 Nov 2025 in each order. 13 can't be a month, so the day-first digits
// never read as a valid date in a month-first field, and vice versa.
const PROBE_ISO = "2025-11-13";
const PROBE_DIGITS: Record<DateFieldOrder, string> = { dmy: "13112025", mdy: "11132025" };

const cache = new WeakMap<Page, DateFieldOrder>();

export async function dateFieldOrder(page: Page): Promise<DateFieldOrder> {
  const known = cache.get(page);
  if (known) return known;

  await page.evaluate(() => {
    const probe = document.createElement("input");
    probe.type = "date";
    probe.id = "__date-order-probe";
    probe.style.cssText = "position:fixed;left:0;top:0;width:220px;height:32px;z-index:2147483647";
    document.body.appendChild(probe);
  });
  const probe = page.locator("#__date-order-probe");
  try {
    for (const order of ["dmy", "mdy"] as const) {
      await probe.evaluate((el) => ((el as HTMLInputElement).value = ""));
      await probe.click({ position: FIRST_SEGMENT });
      await page.keyboard.type(PROBE_DIGITS[order]);
      if ((await probe.inputValue()) === PROBE_ISO) {
        cache.set(page, order);
        return order;
      }
    }
  } finally {
    await probe.evaluate((el) => el.remove());
  }
  throw new Error("Could not tell whether this browser's date input is day-first or month-first");
}

/** The digits a user types for an ISO date ("2026-11-15") in this browser's order. */
export async function dateDigits(page: Page, iso: string): Promise<string> {
  const [year, month, day] = iso.split("-");
  return (await dateFieldOrder(page)) === "dmy" ? `${day}${month}${year}` : `${month}${day}${year}`;
}

/** Click into a date input and type a date key by key, in whatever order the browser expects. */
export async function typeDate(page: Page, field: Locator, iso: string): Promise<void> {
  // Work out the digits BEFORE clicking the field: the first call probes the
  // browser with a throwaway input, which would otherwise steal the focus.
  const digits = await dateDigits(page, iso);
  await field.click({ position: FIRST_SEGMENT });
  await page.keyboard.type(digits);
}
