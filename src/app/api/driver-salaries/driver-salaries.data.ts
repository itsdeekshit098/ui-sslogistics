// Supabase reads shared by the salary routes (sheet, driver detail, export).

import { supabaseAdmin } from "@/lib/supabase";
import type {
  SalaryDriverDetail,
  SalaryEntry,
  SalaryRate,
  SalaryRow,
  SalarySettlement,
  SalarySheet,
} from "@/components/salariesPage/salariesPage.types";
import type { AttendanceMonthDriver } from "@/components/attendancePage/attendancePage.types";
import { loadMonth } from "../driver-attendance/driver-attendance.data";
import { monthRange } from "../driver-attendance/driver-attendance.utils";
import {
  carryForwardIn,
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

function compareDrivers(a: DriverRef, b: DriverRef): number {
  return (
    Number(b.is_active) - Number(a.is_active) ||
    a.name.localeCompare(b.name) ||
    a.id - b.id
  );
}

/**
 * driver_salary_settlements is created by sql/50, applied by hand like every
 * other sql/ file. Until it exists, every month reads as unsettled rather
 * than 500ing the whole salaries page — the same tolerance
 * driver-attendance.data.ts already gives driver_shift_counts (sql/48).
 */
function isMissingTableError(error: { code?: string } | null): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

/**
 * True only for "the settlement_id column doesn't exist yet" — the other
 * thing sql/50 adds, this time to an existing table (driver_salary_entries)
 * rather than a new one. Deliberately narrower than matching any
 * undefined-column error (42703/PGRST204): those codes fire for a genuinely
 * different missing column too, and papering over that would hide a real
 * bug instead of a known, temporary pre-migration state.
 */
function isMissingSettlementColumnError(error: { code?: string; message?: string } | null): boolean {
  if (error?.code !== "PGRST204" && error?.code !== "42703") return false;
  return error.message?.includes("settlement_id") ?? false;
}

/**
 * Whether a driver's month has been settled — used to block entries, rate
 * changes and reversals against a month that was already paid out and
 * closed, so the figure on the settlement receipt can't quietly drift from
 * what's now computed. False (not blocked) when the table doesn't exist yet.
 */
export async function isMonthSettled(driverId: number, month: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("driver_salary_settlements")
    .select("id")
    .eq("driver_id", driverId)
    .eq("period_month", `${month}-01`)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return false;
    throw error;
  }
  return data != null;
}

/**
 * Whether the driver has any settlement on or after `month` — used when
 * setting a salary rate. A rate takes effect from its starting month
 * *forward* (salaryForMonth picks the latest rate on or before each month),
 * so a rate effective back in an earlier month still governs every settled
 * month after it. Checking only the starting month itself (isMonthSettled)
 * misses that: a rate set for June, while August is settled, would pass
 * that check and silently change what August was paid against.
 */
export async function hasSettlementOnOrAfter(driverId: number, month: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("driver_salary_settlements")
    .select("id")
    .eq("driver_id", driverId)
    .gte("period_month", `${month}-01`)
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return false;
    throw error;
  }
  return data != null;
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
  isSettled: boolean,
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
    carry_forward_in: carryForwardIn(entries),
    is_settled: isSettled,
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

  const [attendance, ratesRes, entriesRes, settlementsRes] = await Promise.all([
    loadMonth(month),
    supabaseAdmin
      .from("driver_salary_rates")
      .select("driver_id, monthly_salary, effective_from")
      .lte("effective_from", monthStart),
    supabaseAdmin
      .from("driver_salary_entries")
      .select("id, driver_id, entry_type, amount, reverses_entry_id, settlement_id")
      .eq("period_month", monthStart),
    supabaseAdmin
      .from("driver_salary_settlements")
      .select("driver_id")
      .eq("period_month", monthStart),
  ]);
  if (ratesRes.error) throw ratesRes.error;
  if (settlementsRes.error && !isMissingTableError(settlementsRes.error)) {
    throw settlementsRes.error;
  }

  // Missing the settlement_id column (sql/50 not applied) is not safe to
  // swallow the way a missing table is: entriesRes.data would come back
  // null, so every driver's advances/deductions would silently read as
  // zero and net_pay would overstate what's actually payable — wrong
  // numbers with no error, worse than the page failing to load. Retry the
  // same query without that column instead, which still loads correctly;
  // carry-forward entries just can't be tagged until sql/50 runs.
  let entriesData = entriesRes.data;
  if (entriesRes.error) {
    if (!isMissingSettlementColumnError(entriesRes.error)) throw entriesRes.error;
    const retry = await supabaseAdmin
      .from("driver_salary_entries")
      .select("id, driver_id, entry_type, amount, reverses_entry_id")
      .eq("period_month", monthStart);
    if (retry.error) throw retry.error;
    entriesData = (retry.data ?? []).map((e) => ({ ...e, settlement_id: null }));
  }

  const ratesByDriver = groupBy((ratesRes.data ?? []) as DriverRateRow[]);
  const entriesByDriver = groupBy((entriesData ?? []) as DriverEntryRow[]);
  const settledDrivers = new Set((settlementsRes.data ?? []).map((s) => s.driver_id as number));
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
  }
  drivers.sort(compareDrivers);

  const rows = drivers.map((driver) =>
    buildRow(
      driver,
      attendanceByDriver.get(driver.id),
      ratesByDriver.get(driver.id) ?? [],
      entriesByDriver.get(driver.id) ?? [],
      month,
      attendance.today,
      settledDrivers.has(driver.id),
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

  const [driverRes, attendance, ratesRes, entriesRes, settlementRes] = await Promise.all([
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
    supabaseAdmin
      .from("driver_salary_settlements")
      .select("*")
      .eq("driver_id", driverId)
      .eq("period_month", monthStart)
      .maybeSingle(),
  ]);
  if (driverRes.error) throw driverRes.error;
  if (ratesRes.error) throw ratesRes.error;
  if (entriesRes.error) throw entriesRes.error;
  if (settlementRes.error && !isMissingTableError(settlementRes.error)) {
    throw settlementRes.error;
  }
  if (!driverRes.data) return null;

  const rates = ((ratesRes.data ?? []) as SalaryRate[]).map((rate) => ({
    ...rate,
    monthly_salary: Number(rate.monthly_salary),
  }));
  const rawEntries = (entriesRes.data ?? []) as (Omit<
    SalaryEntry,
    "is_reversed" | "is_reversal" | "is_carry_forward"
  > & { settlement_id: number | null })[];
  const reversed = new Set(
    rawEntries.map((e) => e.reverses_entry_id).filter((id): id is number => id != null),
  );
  const entries: SalaryEntry[] = rawEntries.map((entry) => ({
    ...entry,
    amount: Number(entry.amount),
    is_reversed: reversed.has(entry.id),
    is_reversal: entry.reverses_entry_id != null,
    is_carry_forward: entry.settlement_id != null,
  }));

  const settlementRow = settlementRes.data as
    | {
        id: number;
        period_month: string;
        net_pay_computed: number | string;
        amount_paid: number | string;
        note: string | null;
        carry_forward_entry_id: number | null;
        created_at: string;
      }
    | null;
  const settlement: SalarySettlement | null = settlementRow && {
    id: settlementRow.id,
    period_month: settlementRow.period_month,
    net_pay_computed: Number(settlementRow.net_pay_computed),
    amount_paid: Number(settlementRow.amount_paid),
    note: settlementRow.note,
    carry_forward: Number(settlementRow.amount_paid) - Number(settlementRow.net_pay_computed),
    carry_forward_entry_id: settlementRow.carry_forward_entry_id,
    created_at: settlementRow.created_at,
  };

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
      settlementRow != null,
    ),
    rates,
    entries,
    settlement,
  };
}
