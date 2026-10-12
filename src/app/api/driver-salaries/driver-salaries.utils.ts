// Pure helpers for the salary routes. No Supabase, no request context — the
// pay rule is the part most worth being able to read and test on its own.

import type {
  SalaryRow,
  SalaryTotals,
} from "@/components/salariesPage/salariesPage.types";
import { monthRange } from "../driver-attendance/driver-attendance.utils";

/** Calendar days in a YYYY-MM month. */
export function daysInMonth(month: string): number {
  return Number(monthRange(month).to.slice(8));
}

/** How many days of a month have happened by `today` (0 for a future month). */
export function elapsedDays(month: string, today: string): number {
  const { from, to } = monthRange(month);
  if (today < from) return 0;
  if (today >= to) return daysInMonth(month);
  return Number(today.slice(8));
}

export interface RateRow {
  monthly_salary: number | string;
  /** YYYY-MM-01 */
  effective_from: string;
}

/**
 * The monthly salary in force for a month: the latest rate that took effect
 * on or before it. Null when no salary had been set by then.
 */
export function salaryForMonth(rates: RateRow[], month: string): number | null {
  const monthStart = `${month}-01`;
  let best: RateRow | null = null;
  for (const rate of rates) {
    if (rate.effective_from > monthStart) continue;
    if (!best || rate.effective_from > best.effective_from) best = rate;
  }
  return best ? Number(best.monthly_salary) : null;
}

export interface EntryRow {
  id: number;
  entry_type: string;
  amount: number | string;
  reverses_entry_id: number | null;
}

/**
 * Totals of the entries that still count. A reversed entry and the reversal
 * that cancels it both drop out, so the pair nets to zero.
 */
export function sumLiveEntries(entries: EntryRow[]): { advances: number; deductions: number } {
  const reversed = new Set(
    entries.map((e) => e.reverses_entry_id).filter((id): id is number => id != null),
  );
  let advances = 0;
  let deductions = 0;
  for (const entry of entries) {
    if (entry.reverses_entry_id != null || reversed.has(entry.id)) continue;
    if (entry.entry_type === "ADVANCE") advances += Number(entry.amount);
    else deductions += Number(entry.amount);
  }
  return { advances, deductions };
}

export interface PayInput {
  monthlySalary: number | null;
  daysInMonth: number;
  absentDays: number;
  leaveDays: number;
  advances: number;
  deductions: number;
}

/**
 * The pay rule, in one place.
 *
 *   day's pay      = monthly salary ÷ calendar days in that month
 *   attendance cut = day's pay × (absent days + leave days), to the rupee
 *   net pay        = monthly salary − attendance cut − advances − deductions
 *
 * Leave is unpaid, the same as absent. A day with any shift worked is a paid
 * day, however many shifts; a day with no mark at all is paid too — only an
 * explicit Absent or Leave costs a day's pay, so a day nobody got round to
 * marking never silently docks a driver.
 *
 * The cut never exceeds the salary. Net pay can go below zero when advances
 * outrun what was earned; that is shown, not hidden — it is money the driver
 * owes back.
 */
export function computePay(input: PayInput): {
  unpaid_days: number;
  attendance_cut: number;
  net_pay: number | null;
} {
  const unpaidDays = input.absentDays + input.leaveDays;
  if (input.monthlySalary == null) {
    return { unpaid_days: unpaidDays, attendance_cut: 0, net_pay: null };
  }
  const cut = Math.min(
    input.monthlySalary,
    Math.round((input.monthlySalary * unpaidDays) / input.daysInMonth),
  );
  return {
    unpaid_days: unpaidDays,
    attendance_cut: cut,
    net_pay: input.monthlySalary - cut - input.advances - input.deductions,
  };
}

/** Sheet totals. Drivers with no salary set have nothing to add and are counted apart. */
export function totalsFor(rows: SalaryRow[]): SalaryTotals {
  const totals: SalaryTotals = {
    monthly_salary: 0,
    attendance_cut: 0,
    advances: 0,
    deductions: 0,
    net_pay: 0,
    drivers_without_salary: 0,
  };
  for (const row of rows) {
    if (row.monthly_salary == null || row.net_pay == null) {
      totals.drivers_without_salary += 1;
      continue;
    }
    totals.monthly_salary += row.monthly_salary;
    totals.attendance_cut += row.attendance_cut;
    totals.advances += row.advances;
    totals.deductions += row.deductions;
    totals.net_pay += row.net_pay;
  }
  return totals;
}
