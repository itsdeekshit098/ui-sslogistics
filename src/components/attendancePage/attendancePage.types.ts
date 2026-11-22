export const SHIFTS = ["A", "B", "C"] as const;
export type Shift = (typeof SHIFTS)[number];

/**
 * How many shifts a driver runs in a day: 1, 2 or 3. Which shifts those are
 * is fixed — the first N of A, B, C — so a 2-shift driver works A and B.
 *
 * This is what a *full day* means for that driver, and so what full pay
 * means: a 2-shift driver who works A and B is on a full day, exactly as a
 * 3-shift driver on A+B+C is. Pay is never divided by shift count.
 */
export type ShiftCount = 1 | 2 | 3;

/** What a driver works when nothing has been set for them. */
export const DEFAULT_SHIFT_COUNT: ShiftCount = 3;

/** The shifts a driver of this count works: the first N of A, B, C. */
export function shiftsFor(count: ShiftCount): Shift[] {
  return SHIFTS.slice(0, count) as Shift[];
}

/**
 * A whole-day status that rules out any shift. Present is implied by shifts
 * for a MONTHLY/shift-based driver.
 *
 * ABSENT and LEAVE both cut a day's pay. HOLIDAY does not — it is a day the
 * driver didn't work (the company they serve was closed) but is still paid
 * for, so it behaves like ABSENT/LEAVE for shift marking (no shifts) but like
 * a normal paid day for the salary calculation. PRESENT is only used for a
 * PER_TRIP driver, who has no shift buttons at all — their pay comes from a
 * trip count entered on the Salaries page, so "present" here just records
 * that they worked, not which shift.
 */
export type OffStatus = "ABSENT" | "LEAVE" | "HOLIDAY" | "PRESENT";

/**
 * What one driver did on one day. Shifts and status are mutually exclusive;
 * no shifts and a null status means the day has not been marked.
 *
 * A MONTHLY/shift-based driver is "present" by having shifts and status
 * null. A PER_TRIP driver (no shifts to offer) is "present" by status
 * "PRESENT" and an empty shifts array instead.
 */
export interface AttendanceMark {
  shifts: Shift[];
  status: OffStatus | null;
}

export interface AttendanceDayDriver extends AttendanceMark {
  driver_id: number;
  name: string;
  place: string | null;
  is_active: boolean;
  /** This driver's shifts for this date — a full day is all of them. */
  shift_count: ShiftCount;
  /**
   * How this driver is paid. A PER_TRIP driver has no shift buttons here —
   * only Present/Absent/Leave/Holiday — since their pay comes from a trip
   * count on the Salaries page, not from which shifts they worked.
   */
  pay_type: "MONTHLY" | "PER_TRIP";
  /** The day before, for "as yesterday". Null when that day was not marked. */
  previous: AttendanceMark | null;
}

export interface AttendanceDay {
  date: string;
  /** Today in IST, as the server sees it — clients never compute this. */
  today: string;
  /** Whether the signed-in role may change this date. */
  editable: boolean;
  drivers: AttendanceDayDriver[];
}

export interface AttendanceTotals {
  shifts: number;
  /** Days with at least one shift. */
  days_present: number;
  full_days: number;
  absent: number;
  leave: number;
  /** Paid non-working days — never counted in unpaid_days / the wage cut. */
  holiday: number;
}

export interface AttendanceMonthDriver {
  driver_id: number;
  name: string;
  place: string | null;
  is_active: boolean;
  /** This driver's shifts for this month — a full day is all of them. */
  shift_count: ShiftCount;
  /** See AttendanceDayDriver.pay_type. */
  pay_type: "MONTHLY" | "PER_TRIP";
  /** Marked days only, keyed by YYYY-MM-DD. */
  days: Record<string, AttendanceMark>;
  totals: AttendanceTotals;
}

export interface AttendanceMonth {
  /** YYYY-MM */
  month: string;
  today: string;
  drivers: AttendanceMonthDriver[];
}

/** One row of a driver's shift-count history. */
export interface DriverShiftCount {
  id: number;
  driver_id: number;
  shift_count: ShiftCount;
  /** YYYY-MM-01 — the first month this count applies to. */
  effective_from: string;
  note: string | null;
  created_at: string;
}

/**
 * Days already marked with a shift the driver no longer runs under a newly
 * saved count. Saving a count never edits marks; this only tells the admin
 * which days to review.
 */
export interface ShiftCountConflicts {
  count: number;
  /** YYYY-MM-DD, oldest first, capped so the response stays small. */
  dates: string[];
}

export interface SetShiftCountPayload {
  shift_count: ShiftCount;
  /** YYYY-MM — the first month the count applies to. */
  effective_month: string;
  note?: string | null;
}

export interface SaveAttendanceEntry extends AttendanceMark {
  driver_id: number;
}

export interface SaveAttendancePayload {
  date: string;
  /** Only the drivers that changed. An entry with no shifts and no status clears the mark. */
  entries: SaveAttendanceEntry[];
}

export type AttendanceFilter = "all" | "unmarked" | "present" | "off" | "holiday" | Shift;
