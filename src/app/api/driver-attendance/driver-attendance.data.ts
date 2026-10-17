// Supabase reads shared by the attendance routes (day, month, export).

import { supabaseAdmin } from "@/lib/supabase";
import { isAdmin, type AuthUser } from "@/lib/auth";
import type {
  AttendanceDay,
  AttendanceMark,
  AttendanceMonth,
} from "@/components/attendancePage/attendancePage.types";
import { addDays } from "@/lib/dateOnly";
import {
  monthRange,
  rowToMark,
  shiftCountForDate,
  shiftCountForMonth,
  todayInIndia,
  totalsFor,
  type AttendanceRow,
  type ShiftCountRow,
} from "./driver-attendance.utils";

const PAGE = 1000;
const ROW_COLUMNS = "driver_id, attendance_date, status, shift_a, shift_b, shift_c";

interface DriverRow {
  id: number;
  name: string;
  place: string | null;
  is_active: boolean;
}

/**
 * Marking attendance is admin-only: it decides what a driver is paid, so
 * staff and drivers can read every day but change none. No one marks a
 * future date.
 */
export function canEditDate(user: AuthUser, date: string, today: string): boolean {
  return isAdmin(user.role) && date <= today;
}

/** PostgREST caps a response at 1000 rows; a month of marks passes that at ~33 drivers. */
async function fetchRows(from: string, to: string): Promise<AttendanceRow[]> {
  const rows: AttendanceRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("driver_attendance")
      .select(ROW_COLUMNS)
      .gte("attendance_date", from)
      .lte("attendance_date", to)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as AttendanceRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

async function fetchDrivers(): Promise<DriverRow[]> {
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .select("id, name, place, is_active")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DriverRow[];
}

/**
 * Every shift-count row taking effect on or before [upto] (a YYYY-MM-DD
 * date), grouped by driver. The whole history up to that point is needed,
 * not just the newest row, because the row that applies depends on the month
 * being read — an old month must still see the old count.
 */
async function fetchShiftCounts(upto: string): Promise<Map<number, ShiftCountRow[]>> {
  const { data, error } = await supabaseAdmin
    .from("driver_shift_counts")
    .select("driver_id, shift_count, effective_from")
    .lte("effective_from", `${upto.slice(0, 7)}-01`);
  // The table is created by hand (sql/48). Until it exists, every driver
  // works three shifts, which is exactly how the app behaved before it.
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return new Map();
    throw error;
  }
  const byDriver = new Map<number, ShiftCountRow[]>();
  for (const row of (data ?? []) as ShiftCountRow[]) {
    const list = byDriver.get(row.driver_id);
    if (list) list.push(row);
    else byDriver.set(row.driver_id, [row]);
  }
  return byDriver;
}

/** A driver's shift count for a date, for routes that need just the one. */
export async function shiftCountsForDate(
  date: string,
): Promise<Map<number, ShiftCountRow[]>> {
  return fetchShiftCounts(date);
}

export async function loadDay(user: AuthUser, date: string): Promise<AttendanceDay> {
  const today = todayInIndia();
  const previousDate = addDays(date, -1);
  const [drivers, rows, shiftCounts] = await Promise.all([
    fetchDrivers(),
    fetchRows(previousDate, date),
    fetchShiftCounts(date),
  ]);

  const current = new Map<number, AttendanceMark>();
  const previous = new Map<number, AttendanceMark>();
  for (const row of rows) {
    (row.attendance_date === date ? current : previous).set(row.driver_id, rowToMark(row));
  }

  return {
    date,
    today,
    editable: canEditDate(user, date, today),
    // A deactivated driver still shows on the days they were marked, so an
    // old day reads the same after someone leaves.
    drivers: drivers
      .filter((d) => d.is_active || current.has(d.id))
      .map((d) => ({
        driver_id: d.id,
        name: d.name,
        place: d.place,
        is_active: d.is_active,
        shift_count: shiftCountForDate(shiftCounts.get(d.id) ?? [], date),
        ...(current.get(d.id) ?? { shifts: [], status: null }),
        previous: previous.get(d.id) ?? null,
      })),
  };
}

export async function loadMonth(month: string): Promise<AttendanceMonth> {
  const { from, to } = monthRange(month);
  const [drivers, rows, shiftCounts] = await Promise.all([
    fetchDrivers(),
    fetchRows(from, to),
    fetchShiftCounts(from),
  ]);

  const byDriver = new Map<number, Record<string, AttendanceMark>>();
  for (const row of rows) {
    const days = byDriver.get(row.driver_id) ?? {};
    days[row.attendance_date] = rowToMark(row);
    byDriver.set(row.driver_id, days);
  }

  return {
    month,
    today: todayInIndia(),
    drivers: drivers
      .filter((d) => d.is_active || byDriver.has(d.id))
      .map((d) => {
        const days = byDriver.get(d.id) ?? {};
        const shiftCount = shiftCountForMonth(shiftCounts.get(d.id) ?? [], month);
        return {
          driver_id: d.id,
          name: d.name,
          place: d.place,
          is_active: d.is_active,
          shift_count: shiftCount,
          days,
          // Full days are counted against this driver's own shifts.
          totals: totalsFor(Object.values(days), shiftCount),
        };
      }),
  };
}
