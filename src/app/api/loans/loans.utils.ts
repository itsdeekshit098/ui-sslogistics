// Pure helpers for the loans routes. No Supabase, no request context — the
// schedule maths is the part most likely to be wrong in a subtle way, so it is
// kept isolated and side-effect free.

import { toDateString, parseDate } from "@/lib/dateOnly";

export { toDateString, parseDate };

export interface ScheduleRow {
  installment_no: number;
  due_date: string; // YYYY-MM-DD
  amount_due: number;
}

/** Days in a given month, using UTC so a server timezone can never shift it. */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Builds the full EMI schedule for a loan.
 *
 * Walks month by month from `firstEmiDate`, always in UTC. The EMI day is
 * clamped to the length of each month, so a loan billed on the 31st falls due
 * on the 28th in February (29th in a leap year) and returns to the 31st in
 * March — it does not spill into the following month, which is what naive
 * date-adding does and what would silently shift every later installment.
 *
 * The day is taken from `emiDayOfMonth` rather than from `firstEmiDate`, since
 * a financier will often set an odd first date and then settle onto the
 * mandate day.
 */
export function generateSchedule({
  firstEmiDate,
  emiDayOfMonth,
  emiAmount,
  totalInstallments,
}: {
  firstEmiDate: string;
  emiDayOfMonth: number;
  emiAmount: number;
  totalInstallments: number;
}): ScheduleRow[] {
  const first = parseDate(firstEmiDate);
  const rows: ScheduleRow[] = [];

  for (let i = 0; i < totalInstallments; i += 1) {
    // Month arithmetic on the first-of-month, then the day is applied — going
    // via `setUTCMonth` on a day-31 date would roll over into the next month.
    const year = first.getUTCFullYear();
    const monthIndex = first.getUTCMonth() + i;

    const cursor = new Date(Date.UTC(year, monthIndex, 1));
    const day = Math.min(
      emiDayOfMonth,
      daysInMonth(cursor.getUTCFullYear(), cursor.getUTCMonth()),
    );

    // The very first installment keeps the exact date the lender gave us, even
    // if it doesn't match the mandate day.
    const dueDate =
      i === 0
        ? first
        : new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day));

    rows.push({
      installment_no: i + 1,
      due_date: toDateString(dueDate),
      amount_due: emiAmount,
    });
  }

  return rows;
}

export const LOAN_STATUSES = [
  "ACTIVE",
  "CLOSED",
  "FORECLOSED",
  "DEFAULTED",
] as const;

export const PAYMENT_TYPES = [
  "EMI",
  "PREPAYMENT",
  "FORECLOSURE",
  "CHARGE",
  "ADJUSTMENT",
] as const;

export const INSTALLMENT_MANUAL_STATUSES = ["WAIVED", "BOUNCED"] as const;

export const LOAN_NOTES_MAX_LENGTH = 500;

/**
 * Validates a YYYY-MM-DD string and rejects anything the Date constructor
 * would silently coerce (e.g. "2026-02-31").
 */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = parseDate(value);
  return !Number.isNaN(parsed.getTime()) && toDateString(parsed) === value;
}

/** Finite, non-negative number check for money fields arriving as JSON.
 * `typeof value === "number"` guards against `Number(null|""|false|[])`
 * all coercing to the finite, non-negative value `0`. */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
