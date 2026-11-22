/**
 * Rupee formatters. They live in the UI library because `<Money>` needs them,
 * and the library may not import app code; `src/lib/format.ts` re-exports them
 * so the rest of the app keeps its existing import.
 */

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
