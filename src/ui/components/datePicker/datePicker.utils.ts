/*
 * Date arithmetic on plain "YYYY-MM-DD" strings. No time zones are involved:
 * a date-only value means the same calendar day everywhere, which is how the
 * server stores and compares them. (Computed through Date.UTC only to get day
 * counts and weekdays; no local time is ever read.)
 */

export type ISODate = string;
export interface YMD {
  y: number;
  m: number; // 1-12
  d: number;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The parts of a valid date, or null (also for "2026-02-30" and "2026-13-01"). */
export function parseISODate(value: string | null | undefined): YMD | null {
  const match = value ? ISO.exec(value) : null;
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function toISODate({ y, m, d }: YMD): ISODate {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf({ y, m, d }: YMD): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(iso: ISODate, days: number): ISODate {
  const p = parseISODate(iso)!;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return toISODate({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

/** Moves by whole months, keeping the day where it exists and otherwise the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: ISODate, months: number): ISODate {
  const p = parseISODate(iso)!;
  const index = p.y * 12 + (p.m - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return toISODate({ y, m, d: Math.min(p.d, daysInMonth(y, m)) });
}

export const addYears = (iso: ISODate, years: number) => addMonths(iso, years * 12);

/** Plain string comparison works because the format is fixed-width and most-significant first. */
export const compareISO = (a: ISODate, b: ISODate) => (a < b ? -1 : a > b ? 1 : 0);

export function isOutOfRange(iso: ISODate, min?: ISODate, max?: ISODate): boolean {
  return (!!min && iso < min) || (!!max && iso > max);
}

export function clampToRange(iso: ISODate, min?: ISODate, max?: ISODate): ISODate {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

export interface Day {
  iso: ISODate;
  /** Belongs to the shown month (rather than the previous/next month's overflow). */
  inMonth: boolean;
}

/** The six weeks that cover a month, starting on `weekStartsOn` (0 = Sunday). Always 6 rows, so the popup doesn't change height between months. */
export function monthGrid(y: number, m: number, weekStartsOn = 0): Day[][] {
  const first = toISODate({ y, m, d: 1 });
  const lead = (weekdayOf({ y, m, d: 1 }) - weekStartsOn + 7) % 7;
  const start = addDays(first, -lead);
  const weeks: Day[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Day[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = addDays(start, w * 7 + i);
      row.push({ iso, inMonth: parseISODate(iso)!.m === m });
    }
    weeks.push(row);
  }
  return weeks;
}

const LOCALE = "en-IN";
const utcFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" });

const displayFormat = utcFormat({ day: "numeric", month: "short", year: "numeric" });
const monthYearFormat = utcFormat({ month: "long", year: "numeric" });
const weekdayFormat = utcFormat({ weekday: "short" });
const longFormat = utcFormat({ weekday: "long", day: "numeric", month: "long", year: "numeric" });

const asDate = ({ y, m, d }: YMD) => new Date(Date.UTC(y, m - 1, d));

/** "15 Jun 2026" */
export const formatDisplay = (iso: ISODate): string => displayFormat.format(asDate(parseISODate(iso)!));

/** "Monday, 15 June 2026", for a day's accessible name. */
export const formatLong = (iso: ISODate): string => longFormat.format(asDate(parseISODate(iso)!));

/** "June 2026" */
export const formatMonthYear = (y: number, m: number): string => monthYearFormat.format(asDate({ y, m, d: 1 }));

/** Seven short weekday names ("Sun", "Mon", …) starting on `weekStartsOn`. */
export function weekdayNames(weekStartsOn = 0): string[] {
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) =>
    weekdayFormat.format(new Date(Date.UTC(2023, 0, 1 + ((weekStartsOn + i) % 7)))),
  );
}

// ─── Months ("YYYY-MM") ──────────────────────────────────────────────────────

export type ISOMonth = string;
const MONTH = /^(\d{4})-(\d{2})$/;

export function parseISOMonth(value: string | null | undefined): { y: number; m: number } | null {
  const match = value ? MONTH.exec(value) : null;
  if (!match) return null;
  const [y, m] = [Number(match[1]), Number(match[2])];
  return m >= 1 && m <= 12 ? { y, m } : null;
}

export const toISOMonth = (y: number, m: number): ISOMonth => `${pad(y, 4)}-${pad(m)}`;

/** "Jun 2026" */
export const formatMonthShort = (month: ISOMonth): string => {
  const p = parseISOMonth(month)!;
  return utcFormat({ month: "short", year: "numeric" }).format(asDate({ ...p, d: 1 }));
};

/** "Jun" */
export const monthName = (m: number): string =>
  utcFormat({ month: "short" }).format(asDate({ y: 2023, m, d: 1 }));
