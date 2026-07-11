export type ExpiryStatus = "active" | "expiring_soon" | "expired";

const EXPIRING_SOON_WINDOW_DAYS = 30;

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** UTC "today" and "today + 30 days" as YYYY-MM-DD strings. */
export function getStatusDates(): { today: string; cutoff: string } {
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const cutoffUtc = new Date(todayUtc);
  cutoffUtc.setUTCDate(cutoffUtc.getUTCDate() + EXPIRING_SOON_WINDOW_DAYS);
  return { today: toDateString(todayUtc), cutoff: toDateString(cutoffUtc) };
}

/**
 * Derives active/expiring_soon/expired from a YYYY-MM-DD expiry date,
 * comparing as strings against pre-computed today/cutoff (see getStatusDates).
 * Returns null when there's no expiry date to evaluate.
 */
export function computeExpiryStatus(
  expiryDate: string | null | undefined,
  today: string,
  cutoff: string,
): ExpiryStatus | null {
  if (!expiryDate) return null;
  if (expiryDate < today) return "expired";
  if (expiryDate <= cutoff) return "expiring_soon";
  return "active";
}
