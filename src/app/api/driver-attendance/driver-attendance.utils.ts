// Pure helpers for the attendance route. No Supabase, no request context.

import { parseDate, toDateString } from "@/lib/dateOnly";
import {
  SHIFTS,
  type AttendanceMark,
  type AttendanceTotals,
  type Shift,
} from "@/components/attendancePage/attendancePage.types";

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

/**
 * Today as YYYY-MM-DD in IST. The server runs in UTC, where "today" is still
 * yesterday until 05:30 — exactly when the night shift is being marked.
 */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
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

export function totalsFor(marks: AttendanceMark[]): AttendanceTotals {
  const totals: AttendanceTotals = { shifts: 0, days_present: 0, full_days: 0, absent: 0, leave: 0 };
  for (const mark of marks) {
    totals.shifts += mark.shifts.length;
    if (mark.shifts.length > 0) totals.days_present += 1;
    if (mark.shifts.length === SHIFTS.length) totals.full_days += 1;
    if (mark.status === "ABSENT") totals.absent += 1;
    if (mark.status === "LEAVE") totals.leave += 1;
  }
  return totals;
}

/**
 * Validates one incoming entry's mark. Returns the normalised mark, or a
 * message describing what is wrong with it.
 */
export function parseMark(shifts: unknown, status: unknown): AttendanceMark | string {
  if (!Array.isArray(shifts) || shifts.some((s) => !SHIFTS.includes(s as Shift))) {
    return "Shifts must be a list of A, B or C";
  }
  if (status !== null && status !== undefined && status !== "ABSENT" && status !== "LEAVE") {
    return "Status must be ABSENT, LEAVE or empty";
  }
  const unique = SHIFTS.filter((s) => (shifts as Shift[]).includes(s));
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
