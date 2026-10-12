import { parseDate, toDateString } from "@/lib/dateOnly";
import {
  SHIFTS,
  type AttendanceFilter,
  type AttendanceMark,
  type Shift,
} from "./attendancePage.types";

export const EMPTY_MARK: AttendanceMark = { shifts: [], status: null };
export const FULL_DAY: AttendanceMark = { shifts: [...SHIFTS], status: null };

export function isMarked(mark: AttendanceMark): boolean {
  return mark.shifts.length > 0 || mark.status !== null;
}

export function isFullDay(mark: AttendanceMark): boolean {
  return mark.shifts.length === SHIFTS.length;
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

export function markLabel(mark: AttendanceMark): string {
  if (mark.status === "ABSENT") return "Absent";
  if (mark.status === "LEAVE") return "On leave";
  if (isFullDay(mark)) return "Full day";
  if (mark.shifts.length > 1) return `Shifts ${mark.shifts.join(" + ")}`;
  if (mark.shifts.length === 1) return `Shift ${mark.shifts[0]}`;
  return "Not marked";
}

export function matchesFilter(mark: AttendanceMark, filter: AttendanceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unmarked") return !isMarked(mark);
  if (filter === "present") return mark.shifts.length > 0;
  if (filter === "off") return mark.status !== null;
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

export function addMonths(month: string, months: number): string {
  const [year, m] = month.split("-").map(Number);
  return toDateString(new Date(Date.UTC(year, m - 1 + months, 1))).slice(0, 7);
}

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
