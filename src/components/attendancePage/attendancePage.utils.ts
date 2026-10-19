import { addMonths, parseDate } from "@/lib/dateOnly";
import {
  DEFAULT_SHIFT_COUNT,
  SHIFTS,
  shiftsFor,
  type AttendanceFilter,
  type AttendanceMark,
  type Shift,
  type ShiftCount,
} from "./attendancePage.types";

export const EMPTY_MARK: AttendanceMark = { shifts: [], status: null };

/** A full day for a driver who runs [count] shifts: all of theirs. */
export function fullDayFor(count: ShiftCount = DEFAULT_SHIFT_COUNT): AttendanceMark {
  return { shifts: shiftsFor(count), status: null };
}

/** A three-shift full day, for callers with no driver in hand. */
export const FULL_DAY: AttendanceMark = fullDayFor(DEFAULT_SHIFT_COUNT);

export function isMarked(mark: AttendanceMark): boolean {
  return mark.shifts.length > 0 || mark.status !== null;
}

/** True for a PER_TRIP driver's shift-less "Present" mark. */
export function isShiftlessPresent(mark: AttendanceMark): boolean {
  return mark.status === "PRESENT" && mark.shifts.length === 0;
}

/**
 * A full day is all of *this driver's* shifts, so a two-shift driver on
 * A + B is a full day, exactly as a three-shift driver on A + B + C.
 */
export function isFullDay(
  mark: AttendanceMark,
  count: ShiftCount = DEFAULT_SHIFT_COUNT,
): boolean {
  return mark.shifts.length === count;
}

export function sameMark(a: AttendanceMark, b: AttendanceMark): boolean {
  return a.status === b.status && a.shifts.join("") === b.shifts.join("");
}

/** Adds or removes one shift; picking a shift always clears absent/leave. */
export function toggleShift(mark: AttendanceMark, shift: Shift): AttendanceMark {
  const has = mark.shifts.includes(shift);
  return {
    shifts: SHIFTS.filter((s) => (s === shift ? !has : mark.shifts.includes(s))),
    status: null,
  };
}

export function markLabel(
  mark: AttendanceMark,
  count: ShiftCount = DEFAULT_SHIFT_COUNT,
): string {
  if (mark.status === "ABSENT") return "Absent";
  if (mark.status === "LEAVE") return "On leave";
  if (mark.status === "HOLIDAY") return "Holiday";
  if (mark.status === "PRESENT") return "Present";
  if (isFullDay(mark, count)) return "Full day";
  if (mark.shifts.length > 1) return `Shifts ${mark.shifts.join(" + ")}`;
  if (mark.shifts.length === 1) return `Shift ${mark.shifts[0]}`;
  return "Not marked";
}

export function matchesFilter(mark: AttendanceMark, filter: AttendanceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unmarked") return !isMarked(mark);
  if (filter === "present") return mark.shifts.length > 0 || mark.status === "PRESENT";
  // "Off" means a day the driver didn't work and wasn't paid full salary
  // for by default — Holiday is excluded, since it's a paid non-working day,
  // not a gap in the roster the way Absent/Leave are.
  if (filter === "off") return mark.status === "ABSENT" || mark.status === "LEAVE";
  if (filter === "holiday") return mark.status === "HOLIDAY";
  return mark.shifts.includes(filter);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// Shared with the Salaries page, so it lives in lib; re-exported to keep
// this module's existing imports working.
export { addMonths };

/** Every date in a YYYY-MM month, in order. */
export function datesInMonth(month: string): string[] {
  const [year, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** 0 = Sunday. */
export function weekday(date: string): number {
  return parseDate(date).getUTCDay();
}

/** "Sun, 11 Oct" — the year is left to the month heading and date picker. */
export function formatDayLabel(date: string): string {
  return parseDate(date).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "Sunday" */
export function formatWeekday(date: string): string {
  return parseDate(date).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
}

/** "Oct 2026" — the phone header has no room for the full month name. */
export function formatMonthShort(month: string): string {
  return parseDate(`${month}-01`).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
