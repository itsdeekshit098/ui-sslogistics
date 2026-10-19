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
  /** Set when this row is the carry-forward a settlement produced. */
  settlement_id?: number | null;
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

/**
 * The portion of this month's advances/deductions that is a carry-forward
 * from a prior settlement, signed: positive means the driver was overpaid
 * last month (counted here as an advance), negative means underpaid
 * (counted as a deduction). Purely for labelling — it is already included
 * in sumLiveEntries' totals and never changes the pay rule.
 */
export function carryForwardIn(entries: EntryRow[]): number {
  const reversed = new Set(
    entries.map((e) => e.reverses_entry_id).filter((id): id is number => id != null),
  );
  let total = 0;
  for (const entry of entries) {
    if (entry.settlement_id == null) continue;
    if (entry.reverses_entry_id != null || reversed.has(entry.id)) continue;
    total += entry.entry_type === "ADVANCE" ? Number(entry.amount) : -Number(entry.amount);
  }
  return total;
}

export interface MonthlyPayInput {
  monthlySalary: number | null;
  daysInMonth: number;
  absentDays: number;
  leaveDays: number;
  advances: number;
  deductions: number;
}

/**
 * The MONTHLY pay rule, in one place.
 *
 *   day's pay      = monthly salary ÷ calendar days in that month
 *   attendance cut = day's pay × (absent days + leave days), to the rupee
 *   net pay        = monthly salary − attendance cut − advances − deductions
 *
 * Leave is unpaid, the same as absent. Holiday is *not* unpaid — a company
 * holiday is a paid day, so it is excluded here exactly like a day nobody
 * marked. A day with any shift worked is a paid day, however many shifts; a
 * day with no mark at all is paid too — only an explicit Absent or Leave
 * costs a day's pay, so a day nobody got round to marking never silently
 * docks a driver.
 *
 * The cut never exceeds the salary. Net pay can go below zero when advances
 * outrun what was earned; that is shown, not hidden — it is money the driver
 * owes back.
 */
export function computeMonthlyPay(input: MonthlyPayInput): {
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

export interface PerTripPayInput {
  ratePerTrip: number | null;
  tripCount: number | null;
  advances: number;
  deductions: number;
}

/**
 * The PER_TRIP pay rule.
 *
 *   net pay = rate per trip × trip count − advances − deductions
 *
 * There is no per-day cut: attendance (Present/Absent/Leave/Holiday) is
 * still tracked for a PER_TRIP driver, but only the trip count and rate
 * decide pay — an Absent day doesn't reduce it, because the trip count
 * already reflects however much (or little) the driver actually drove that
 * month. Null until both the rate and the trip count are known.
 */
export function computePerTripPay(input: PerTripPayInput): {
  net_pay: number | null;
} {
  if (input.ratePerTrip == null || input.tripCount == null) {
    return { net_pay: null };
  }
  return {
    net_pay: input.ratePerTrip * input.tripCount - input.advances - input.deductions,
  };
}

/** @deprecated use computeMonthlyPay — kept so a stray import fails loudly rather than silently. */
export type PayInput = MonthlyPayInput;

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
    // "No pay to work from yet" is net_pay being null, not monthly_salary
    // being null — a PER_TRIP driver has no monthly_salary at all (that's
    // the MONTHLY-only figure) but is fully configured once their rate and
    // trip count are set, at which point net_pay is not null.
    if (row.net_pay == null) {
      totals.drivers_without_salary += 1;
      continue;
    }
    // Summed across both pay types so it reads as "what's on the books",
    // even though monthly_salary itself is only ever non-null for MONTHLY
    // rows — a PER_TRIP driver's monthly_salary is always null, so they add
    // 0 here while still contributing to net_pay.
    totals.monthly_salary += row.monthly_salary ?? 0;
    totals.attendance_cut += row.attendance_cut;
    totals.advances += row.advances;
    totals.deductions += row.deductions;
    totals.net_pay += row.net_pay;
  }
  return totals;
}

export interface PayTypeRow {
  pay_type: string;
  rate_per_trip: number | string | null;
  effective_from: string;
}

/**
 * The pay type (and, for PER_TRIP, the rate) in force for a month: the
 * latest row that took effect on or before it. Same shape as
 * salaryForMonth/shiftCountForMonth, so changing a driver's pay type never
 * rewrites how past months were paid.
 *
 * With nothing set, a driver is MONTHLY — today's only pay model, so an
 * untouched database behaves exactly as before this file existed.
 */
export function payTypeForMonth(
  rows: PayTypeRow[],
  month: string,
): { payType: "MONTHLY" | "PER_TRIP"; ratePerTrip: number | null } {
  const monthStart = `${month}-01`;
  let best: PayTypeRow | null = null;
  for (const row of rows) {
    if (row.effective_from > monthStart) continue;
    if (!best || row.effective_from > best.effective_from) best = row;
  }
  if (!best || best.pay_type !== "PER_TRIP") {
    return { payType: "MONTHLY", ratePerTrip: null };
  }
  return { payType: "PER_TRIP", ratePerTrip: Number(best.rate_per_trip) };
}

export interface TripCountRow {
  period_month: string;
  trip_count: number | string;
}

/** This driver's entered trip count for exactly this month, or null if none was entered. */
export function tripCountForMonth(rows: TripCountRow[], month: string): number | null {
  const monthStart = `${month}-01`;
  const row = rows.find((r) => r.period_month === monthStart);
  return row ? Number(row.trip_count) : null;
}
