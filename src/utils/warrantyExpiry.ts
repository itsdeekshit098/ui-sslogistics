/**
 * Compute warranty expiry date from purchase date + duration + unit.
 *
 * Handles month-end clamping: e.g. Jan 31 + 1 month → Feb 28 (not Mar 2).
 * Works in UTC to avoid timezone issues.
 */
export function computeWarrantyExpiry(
  purchaseDate: string,
  duration: number,
  unit: "months" | "years",
): string {
  if (!purchaseDate || !Number.isFinite(duration) || duration <= 0) return "";
  const date = new Date(purchaseDate + "T00:00:00Z");
  if (isNaN(date.getTime())) return "";

  const originalDay = date.getUTCDate();

  if (unit === "months") {
    date.setUTCMonth(date.getUTCMonth() + duration);
  } else {
    date.setUTCFullYear(date.getUTCFullYear() + duration);
  }

  // Clamp to last day of target month if overflow occurred
  // e.g. Jan 31 + 1 month → setUTCMonth gives Mar 3 → clamp back to Feb 28/29
  if (date.getUTCDate() !== originalDay) {
    date.setUTCDate(0); // sets to last day of the *previous* month
  }

  return date.toISOString().slice(0, 10);
}

/**
 * Frontend version that accepts string duration (from form inputs).
 * Returns ISO date string (YYYY-MM-DD) or empty string.
 */
export function computeExpiryDateFromStrings(
  purchaseDate: string,
  duration: string,
  unit: "months" | "years",
): string {
  const dur = parseInt(duration);
  if (isNaN(dur) || dur <= 0) return "";
  return computeWarrantyExpiry(purchaseDate, dur, unit);
}
