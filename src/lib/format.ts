// Generic, feature-agnostic formatters — a rupee figure, a date-only string,
// a month heading, or today's date — used across Loans, Fundings and Clients
// alike, plus the shared <Money> UI primitive. Kept out of any one feature's
// folder specifically so nothing has to reach into another feature's code
// just to print a number.

/** Indian-format rupees with no paise — how these amounts are actually spoken. */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Keeps paise, for interest figures where rounding to rupees would mislead. */
export function formatCurrencyPrecise(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `₹${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "12 Aug 2026" — parsed as UTC so a date-only value can't shift a day. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "August 2026", for the calendar and interest-breakdown headings. */
export function formatMonth(value: string): string {
  const [year, month] = value.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today as YYYY-MM-DD, matching how the API compares date-only columns. */
export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}
