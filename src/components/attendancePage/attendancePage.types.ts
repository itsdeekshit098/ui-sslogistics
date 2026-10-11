export const SHIFTS = ["A", "B", "C"] as const;
export type Shift = (typeof SHIFTS)[number];

/** A whole-day status that rules out any shift. Present is implied by shifts. */
export type OffStatus = "ABSENT" | "LEAVE";

/**
 * What one driver did on one day. Shifts and status are mutually exclusive;
 * no shifts and a null status means the day has not been marked.
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
}

export interface AttendanceMonthDriver {
  driver_id: number;
  name: string;
  place: string | null;
  is_active: boolean;
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

export interface SaveAttendanceEntry extends AttendanceMark {
  driver_id: number;
}

export interface SaveAttendancePayload {
  date: string;
  /** Only the drivers that changed. An entry with no shifts and no status clears the mark. */
  entries: SaveAttendanceEntry[];
}

export type AttendanceFilter = "all" | "unmarked" | "off" | Shift;
