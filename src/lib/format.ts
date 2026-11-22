// Generic, feature-agnostic formatters — a rupee figure, a date-only string,
// a month heading, or today's date — used across Loans, Fundings and Clients
// alike, plus the shared <Money> UI primitive. Kept out of any one feature's
// folder specifically so nothing has to reach into another feature's code
// just to print a number.

// formatCurrency / formatCurrencyPrecise are defined in the UI library (the
// <Money> primitive needs them) and re-exported here so callers don't change.
export { formatCurrency, formatCurrencyPrecise } from "@ui/utils/formatCurrency";

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

/** "12 Aug 26" — for a table column too narrow for the full year. */
export function formatDateCompact(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
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
