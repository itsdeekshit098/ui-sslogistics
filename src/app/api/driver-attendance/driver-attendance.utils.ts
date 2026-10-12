// Pure helpers for the attendance route. No Supabase, no request context.

import { parseDate, toDateString, todayInIndia } from "@/lib/dateOnly";

export { todayInIndia };
import {
  DEFAULT_SHIFT_COUNT,
  SHIFTS,
  shiftsFor,
  type AttendanceMark,
  type AttendanceTotals,
  type Shift,
  type ShiftCount,
} from "@/components/attendancePage/attendancePage.types";

/** A row of driver_shift_counts, as the register reads it. */
export interface ShiftCountRow {
  driver_id: number;
  shift_count: number;
  effective_from: string;
}

/**
 * How many shifts a driver worked in a given month: the latest row taking
 * effect on or before it. Same shape as salaryForMonth, so a change of
 * duties never rewrites the months before it.
 *
 * [rows] may hold any driver's rows in any order; only this driver's count
 * is read. With nothing set, a driver works all three shifts.
 */
export function shiftCountForMonth(rows: ShiftCountRow[], month: string): ShiftCount {
  const monthStart = `${month}-01`;
  let best: ShiftCountRow | null = null;
  for (const row of rows) {
    if (row.effective_from > monthStart) continue;
    if (!best || row.effective_from > best.effective_from) best = row;
  }
  const count = best ? Number(best.shift_count) : DEFAULT_SHIFT_COUNT;
  return count === 1 || count === 2 || count === 3 ? count : DEFAULT_SHIFT_COUNT;
}

/** The same lookup for one date rather than a month. */
export function shiftCountForDate(rows: ShiftCountRow[], date: string): ShiftCount {
  return shiftCountForMonth(rows, date.slice(0, 7));
}

export interface AttendanceRow {
  driver_id: number;
  attendance_date: string;
  status: "PRESENT" | "ABSENT" | "LEAVE";
  shift_a: boolean;
  shift_b: boolean;
  shift_c: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** True only for a real calendar date — "2026-02-30" is rejected. */
export function isValidDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DATE_RE.test(value) &&
    toDateString(parseDate(value)) === value
  );
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value) && isValidDate(`${value}-01`);
}

/** First and last day of a YYYY-MM month. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  return {
    from: `${month}-01`,
    to: toDateString(new Date(Date.UTC(year, m, 0))),
  };
}

export function rowToMark(row: AttendanceRow): AttendanceMark {
  if (row.status !== "PRESENT") return { shifts: [], status: row.status };
  const shifts: Shift[] = [];
  if (row.shift_a) shifts.push("A");
  if (row.shift_b) shifts.push("B");
  if (row.shift_c) shifts.push("C");
  return { shifts, status: null };
}

/**
 * [shiftCount] is the driver's own number of shifts, so a full day is all of
 * *their* shifts: a 2-shift driver who worked A and B has a full day, the
 * same as a 3-shift driver on A+B+C.
 */
export function totalsFor(
  marks: AttendanceMark[],
  shiftCount: ShiftCount = DEFAULT_SHIFT_COUNT,
): AttendanceTotals {
  const totals: AttendanceTotals = { shifts: 0, days_present: 0, full_days: 0, absent: 0, leave: 0 };
  for (const mark of marks) {
    totals.shifts += mark.shifts.length;
    if (mark.shifts.length > 0) totals.days_present += 1;
    if (mark.shifts.length === shiftCount) totals.full_days += 1;
    if (mark.status === "ABSENT") totals.absent += 1;
    if (mark.status === "LEAVE") totals.leave += 1;
  }
  return totals;
}

/**
 * Validates one incoming entry's mark. Returns the normalised mark, or a
 * message describing what is wrong with it.
 */
export function parseMark(
  shifts: unknown,
  status: unknown,
  shiftCount: ShiftCount = DEFAULT_SHIFT_COUNT,
): AttendanceMark | string {
  if (!Array.isArray(shifts) || shifts.some((s) => !SHIFTS.includes(s as Shift))) {
    return "Shifts must be a list of A, B or C";
  }
  if (status !== null && status !== undefined && status !== "ABSENT" && status !== "LEAVE") {
    return "Status must be ABSENT, LEAVE or empty";
  }
  const unique = SHIFTS.filter((s) => (shifts as Shift[]).includes(s));
  // A driver who runs two shifts cannot be marked on C: the request is
  // either stale (their duties changed while the screen was open) or
  // hand-made, and silently dropping the shift would record a day that was
  // never worked.
  const allowed = shiftsFor(shiftCount);
  const extra = unique.filter((s) => !allowed.includes(s));
  if (extra.length > 0) {
    return `This driver works ${allowed.join(" and ")} only, so shift ${extra.join(", ")} cannot be marked`;
  }
  if (status && unique.length > 0) {
    return "A driver cannot be absent or on leave and also work a shift";
  }
  return { shifts: unique, status: (status as AttendanceMark["status"]) ?? null };
}

/** How one day reads in the export: "ABC", "AC", "Absent", "Leave" or blank. */
export function markCode(mark: AttendanceMark | undefined): string {
  if (!mark) return "";
  if (mark.status === "ABSENT") return "Absent";
  if (mark.status === "LEAVE") return "Leave";
  return mark.shifts.join("");
}
