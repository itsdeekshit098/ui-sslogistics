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
  todayInIndia,
  totalsFor,
  type AttendanceRow,
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
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DriverRow[];
}

export async function loadDay(user: AuthUser, date: string): Promise<AttendanceDay> {
  const today = todayInIndia();
  const previousDate = addDays(date, -1);
  const [drivers, rows] = await Promise.all([fetchDrivers(), fetchRows(previousDate, date)]);

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
        ...(current.get(d.id) ?? { shifts: [], status: null }),
        previous: previous.get(d.id) ?? null,
      })),
  };
}

export async function loadMonth(month: string): Promise<AttendanceMonth> {
  const { from, to } = monthRange(month);
  const [drivers, rows] = await Promise.all([fetchDrivers(), fetchRows(from, to)]);

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
        return {
          driver_id: d.id,
          name: d.name,
          place: d.place,
          is_active: d.is_active,
          days,
          totals: totalsFor(Object.values(days)),
        };
      }),
  };
}
