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

/** The most any single loan figure may be: ₹100 crore. Catches a mistyped extra digit. */
export const MAX_LOAN_AMOUNT = 1_000_000_000;
/** Annual interest above this is a typo, not a rate. */
export const MAX_INTEREST_RATE = 100;

export type MoneyProblem = "invalid" | "too_large" | "too_precise";

/**
 * Checks a money figure arriving as JSON: a finite number, positive (or zero
 * when `allowZero`), no more than `max` and no finer than a paisa. Without a
 * ceiling a mistyped 1e20 is accepted and corrupts every total; without the
 * paisa check 100.555 is stored and then shown rounded.
 */
export function moneyProblem(
  value: unknown,
  { allowZero = false, max = MAX_LOAN_AMOUNT }: { allowZero?: boolean; max?: number } = {},
): MoneyProblem | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return "invalid";
  if (allowZero ? value < 0 : value <= 0) return "invalid";
  if (value > max) return "too_large";
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return "too_precise";
  return null;
}

/** The message for a failed moneyProblem, with `invalid` worded by the caller. */
export function moneyMessage(problem: MoneyProblem, invalidMessage: string): string {
  if (problem === "too_large") return "That amount is too large";
  if (problem === "too_precise") return "Amounts can have at most 2 decimal places";
  return invalidMessage;
}

/**
 * A database id from a URL or query string: digits only, greater than zero.
 * `Number()` alone lets "1.5", "" and " " through, which Postgres then rejects
 * as an integer-syntax error that surfaces as a 500.
 */
export function parseId(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d{1,15}$/.test(text)) return null;
  const id = Number(text);
  return id > 0 ? id : null;
}

export const LOAN_SORTS = ["ending_soon", "newest"] as const;
export type LoanSort = (typeof LOAN_SORTS)[number];

interface SortableLoan {
  id: number;
  start_date: string;
  status: string;
  balance: { final_due_date: string | null };
}

/**
 * Orders loans for the list. "Ending soon" puts the loan whose last EMI falls
 * soonest first — the one closest to being finished — so active loans come
 * before closed ones, and a loan with no schedule goes last. Closed loans,
 * which are only history, run most recently ended first. Ties fall back to
 * newest first so the order stays stable across page turns.
 */
export function sortLoans<T extends SortableLoan>(rows: T[], sort: LoanSort): T[] {
  const newest = (a: T, b: T) => b.start_date.localeCompare(a.start_date) || b.id - a.id;
  if (sort === "newest") return [...rows].sort(newest);

  return [...rows].sort((a, b) => {
    const aActive = a.status === "ACTIVE";
    const bActive = b.status === "ACTIVE";
    if (aActive !== bActive) return aActive ? -1 : 1;

    const aEnd = a.balance.final_due_date;
    const bEnd = b.balance.final_due_date;
    if (aEnd !== bEnd) {
      if (!aEnd) return 1;
      if (!bEnd) return -1;
      return aActive ? aEnd.localeCompare(bEnd) : bEnd.localeCompare(aEnd);
    }
    return newest(a, b);
  });
}
