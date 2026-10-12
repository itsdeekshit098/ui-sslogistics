// Supabase reads shared by the salary routes (sheet, driver detail, export).

import { supabaseAdmin } from "@/lib/supabase";
import type {
  SalaryDriverDetail,
  SalaryEntry,
  SalaryRate,
  SalaryRow,
  SalarySheet,
} from "@/components/salariesPage/salariesPage.types";
import type { AttendanceMonthDriver } from "@/components/attendancePage/attendancePage.types";
import { loadMonth } from "../driver-attendance/driver-attendance.data";
import { monthRange } from "../driver-attendance/driver-attendance.utils";
import {
  computePay,
  daysInMonth,
  elapsedDays,
  salaryForMonth,
  sumLiveEntries,
  totalsFor,
  type EntryRow,
  type RateRow,
} from "./driver-salaries.utils";

interface DriverRef {
  id: number;
  name: string;
  place: string | null;
  is_active: boolean;
}

type DriverRateRow = RateRow & { driver_id: number };
type DriverEntryRow = EntryRow & { driver_id: number };

function groupBy<T extends { driver_id: number }>(rows: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const list = map.get(row.driver_id);
    if (list) list.push(row);
    else map.set(row.driver_id, [row]);
  }
  return map;
}

function buildRow(
  driver: DriverRef,
  attendance: AttendanceMonthDriver | undefined,
  rates: RateRow[],
  entries: EntryRow[],
  month: string,
  today: string,
): SalaryRow {
  const monthlySalary = salaryForMonth(rates, month);
  const { advances, deductions } = sumLiveEntries(entries);
  const absentDays = attendance?.totals.absent ?? 0;
  const leaveDays = attendance?.totals.leave ?? 0;
  const markedDays = attendance ? Object.keys(attendance.days).length : 0;
  const pay = computePay({
    monthlySalary,
    daysInMonth: daysInMonth(month),
    absentDays,
    leaveDays,
    advances,
    deductions,
  });

  return {
    driver_id: driver.id,
    name: driver.name,
    place: driver.place,
    is_active: driver.is_active,
    monthly_salary: monthlySalary,
    days_present: attendance?.totals.days_present ?? 0,
    absent_days: absentDays,
    leave_days: leaveDays,
    unmarked_days: Math.max(0, elapsedDays(month, today) - markedDays),
    advances,
    deductions,
    ...pay,
  };
}

/**
 * The salary sheet for a month: one line per driver who is active or has
 * anything recorded against the month (an attendance mark, an advance, a
 * deduction) — so someone who left mid-month, or took an advance and never
 * came back, still shows.
 */
export async function loadSalarySheet(month: string): Promise<SalarySheet> {
  const monthStart = `${month}-01`;

  const [attendance, ratesRes, entriesRes] = await Promise.all([
    loadMonth(month),
    supabaseAdmin
      .from("driver_salary_rates")
      .select("driver_id, monthly_salary, effective_from")
      .lte("effective_from", monthStart),
    supabaseAdmin
      .from("driver_salary_entries")
      .select("id, driver_id, entry_type, amount, reverses_entry_id")
      .eq("period_month", monthStart),
  ]);
  if (ratesRes.error) throw ratesRes.error;
  if (entriesRes.error) throw entriesRes.error;

  const ratesByDriver = groupBy((ratesRes.data ?? []) as DriverRateRow[]);
  const entriesByDriver = groupBy((entriesRes.data ?? []) as DriverEntryRow[]);
  const attendanceByDriver = new Map(attendance.drivers.map((d) => [d.driver_id, d]));

  const drivers: DriverRef[] = attendance.drivers.map((d) => ({
    id: d.driver_id,
    name: d.name,
    place: d.place,
    is_active: d.is_active,
  }));

  // Inactive drivers with no marks this month are not in the attendance
  // list, but an advance or deduction against the month still belongs here.
  const missing = [...entriesByDriver.keys()].filter((id) => !attendanceByDriver.has(id));
  if (missing.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("drivers")
      .select("id, name, place, is_active")
      .in("id", missing);
    if (error) throw error;
    drivers.push(...((data ?? []) as DriverRef[]));
    drivers.sort((a, b) => a.name.localeCompare(b.name));
  }

  const rows = drivers.map((driver) =>
    buildRow(
      driver,
      attendanceByDriver.get(driver.id),
      ratesByDriver.get(driver.id) ?? [],
      entriesByDriver.get(driver.id) ?? [],
      month,
      attendance.today,
    ),
  );

  return {
    month,
    today: attendance.today,
    days_in_month: daysInMonth(month),
    is_provisional: monthRange(month).to >= attendance.today,
    drivers: rows,
    totals: totalsFor(rows),
  };
}

/**
 * One driver's month: their line on the sheet, their salary history, and the
 * advances and deductions behind the figures. Null when the driver doesn't
 * exist.
 */
export async function loadDriverSalary(
  driverId: number,
  month: string,
): Promise<SalaryDriverDetail | null> {
  const monthStart = `${month}-01`;

  const [driverRes, attendance, ratesRes, entriesRes] = await Promise.all([
    supabaseAdmin
      .from("drivers")
      .select("id, name, place, is_active")
      .eq("id", driverId)
      .maybeSingle(),
    loadMonth(month),
    supabaseAdmin
      .from("driver_salary_rates")
      .select("id, driver_id, monthly_salary, effective_from, note, created_at")
      .eq("driver_id", driverId)
      .order("effective_from", { ascending: false }),
    supabaseAdmin
      .from("driver_salary_entries")
      .select("*")
      .eq("driver_id", driverId)
      .eq("period_month", monthStart)
      .order("entry_date", { ascending: false })
      .order("id", { ascending: false }),
  ]);
  if (driverRes.error) throw driverRes.error;
  if (ratesRes.error) throw ratesRes.error;
  if (entriesRes.error) throw entriesRes.error;
  if (!driverRes.data) return null;

  const rates = ((ratesRes.data ?? []) as SalaryRate[]).map((rate) => ({
    ...rate,
    monthly_salary: Number(rate.monthly_salary),
  }));
  const rawEntries = (entriesRes.data ?? []) as Omit<SalaryEntry, "is_reversed" | "is_reversal">[];
  const reversed = new Set(
    rawEntries.map((e) => e.reverses_entry_id).filter((id): id is number => id != null),
  );
  const entries: SalaryEntry[] = rawEntries.map((entry) => ({
    ...entry,
    amount: Number(entry.amount),
    is_reversed: reversed.has(entry.id),
    is_reversal: entry.reverses_entry_id != null,
  }));

  return {
    month,
    days_in_month: daysInMonth(month),
    is_provisional: monthRange(month).to >= attendance.today,
    row: buildRow(
      driverRes.data as DriverRef,
      attendance.drivers.find((d) => d.driver_id === driverId),
      rates,
      rawEntries,
      month,
      attendance.today,
    ),
    rates,
    entries,
  };
}
