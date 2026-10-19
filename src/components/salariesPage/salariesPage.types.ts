export const SALARY_ENTRY_TYPES = ["ADVANCE", "DEDUCTION"] as const;
export type SalaryEntryType = (typeof SALARY_ENTRY_TYPES)[number];

export const SALARY_DESCRIPTION_MAX_LENGTH = 300;

export const PAY_TYPES = ["MONTHLY", "PER_TRIP"] as const;
/**
 * How a driver is paid, set once per driver (dated, like a salary rate or
 * shift count — see driver_pay_types, sql/51). MONTHLY is today's only rule:
 * a fixed monthly salary, cut for Absent/Leave. PER_TRIP pays a rate per
 * trip times a trip count entered by hand each month; attendance is still
 * tracked for a PER_TRIP driver (Present/Absent/Leave/Holiday) but has no
 * shift buttons and never affects their pay — only the trip count and rate
 * do.
 */
export type PayType = (typeof PAY_TYPES)[number];
/** A driver with no pay-type row is MONTHLY — today's only rule, unchanged. */
export const DEFAULT_PAY_TYPE: PayType = "MONTHLY";

/**
 * One driver's line on a month's salary sheet. Every money figure here is
 * worked out by the server from the salary rate, the attendance marks and the
 * advance/deduction entries — the clients display it and never recompute it.
 */
export interface SalaryRow {
  driver_id: number;
  name: string;
  place: string | null;
  is_active: boolean;
  /** How this driver is paid this month. Decides which of the fields below apply. */
  pay_type: PayType;
  /** MONTHLY only. Null until a salary has been set for this driver for this month or earlier. */
  monthly_salary: number | null;
  /** PER_TRIP only. Null until a rate has been set. */
  rate_per_trip: number | null;
  /** PER_TRIP only. Null until a trip count has been entered for this month. */
  trip_count: number | null;
  days_present: number;
  absent_days: number;
  leave_days: number;
  /** Paid non-working days (company holiday). Never counted in unpaid_days. */
  holiday_days: number;
  /** Days up to today with no attendance mark. They are paid, not cut. */
  unmarked_days: number;
  /** MONTHLY only — always 0 for PER_TRIP. Absent + leave: the days a day's pay is cut for. */
  unpaid_days: number;
  /** MONTHLY only — always 0 for PER_TRIP, which has no per-day cut. */
  attendance_cut: number;
  advances: number;
  deductions: number;
  /**
   * Null when there is nothing to work pay from yet (no salary set for
   * MONTHLY, or no rate/trip count entered for PER_TRIP). Can be negative.
   */
  net_pay: number | null;
  /**
   * Carried in from last month's settlement, already folded into advances
   * (positive) or deductions (negative magnitude) above — this is only so
   * the UI can label that part of the figure instead of it reading as a
   * fresh advance/deduction taken this month. Zero when last month wasn't
   * settled, or settled exactly.
   */
  carry_forward_in: number;
  /** This month has been settled (paid out and closed); see `settlement`. */
  is_settled: boolean;
}

export interface SalaryTotals {
  monthly_salary: number;
  attendance_cut: number;
  advances: number;
  deductions: number;
  net_pay: number;
  /** Drivers on the sheet with no salary set, left out of the totals above. */
  drivers_without_salary: number;
}

export interface SalarySheet {
  /** YYYY-MM */
  month: string;
  /** Today in IST, as the server sees it. */
  today: string;
  days_in_month: number;
  /** True while the month has not finished: later absences will still change it. */
  is_provisional: boolean;
  drivers: SalaryRow[];
  totals: SalaryTotals;
}

export interface SalaryRate {
  id: number;
  driver_id: number;
  monthly_salary: number;
  /** YYYY-MM-01 — the first month this salary applies to. */
  effective_from: string;
  note: string | null;
  created_at: string;
}

export interface SalaryEntry {
  id: number;
  driver_id: number;
  entry_type: SalaryEntryType;
  amount: number;
  entry_date: string;
  /** YYYY-MM-01 — the salary month this comes out of. */
  period_month: string;
  description: string | null;
  reverses_entry_id: number | null;
  created_at: string;
  /** This entry was cancelled by a later one; neither counts. */
  is_reversed: boolean;
  /** This entry is the cancellation of an earlier one; neither counts. */
  is_reversal: boolean;
  /** This entry is the carry-forward a prior settlement produced, not something entered by hand. */
  is_carry_forward: boolean;
}

/** A month closed out: what was owed, what was actually paid, and what (if anything) carried forward. */
export interface SalarySettlement {
  id: number;
  /** YYYY-MM-01 */
  period_month: string;
  net_pay_computed: number;
  amount_paid: number;
  note: string | null;
  /** Positive: driver was overpaid, carried forward as next month's advance.
   *  Negative: driver was underpaid, carried forward as next month's deduction.
   *  Zero: paid exactly what was owed. */
  carry_forward: number;
  carry_forward_entry_id: number | null;
  created_at: string;
}

/** One row of a driver's pay-type history. */
export interface DriverPayType {
  id: number;
  driver_id: number;
  pay_type: PayType;
  /** Set only when pay_type is PER_TRIP. */
  rate_per_trip: number | null;
  /** YYYY-MM-01 — the first month this pay type applies to. */
  effective_from: string;
  note: string | null;
  created_at: string;
}

export interface SetPayTypePayload {
  pay_type: PayType;
  /** Required when pay_type is PER_TRIP; omitted/ignored for MONTHLY. */
  rate_per_trip?: number;
  /** YYYY-MM — the first month the pay type applies to. */
  effective_month: string;
  note?: string | null;
}

/** One month's trip count for a PER_TRIP driver — corrected in place, not appended. */
export interface DriverTripCount {
  id: number;
  driver_id: number;
  /** YYYY-MM-01 */
  period_month: string;
  trip_count: number;
  note: string | null;
  created_at: string;
}

export interface SetTripCountPayload {
  /** YYYY-MM */
  period_month: string;
  trip_count: number;
  note?: string | null;
}

export interface SalaryDriverDetail {
  month: string;
  days_in_month: number;
  is_provisional: boolean;
  row: SalaryRow;
  /** Newest first. MONTHLY drivers only — empty for PER_TRIP. */
  rates: SalaryRate[];
  /** This driver's pay-type history, newest first. */
  payTypes: DriverPayType[];
  /** This month's trip count, or null if not entered. PER_TRIP drivers only. */
  tripCount: DriverTripCount | null;
  /** This month's advances and deductions, newest first. */
  entries: SalaryEntry[];
  /** This month's settlement, or null if not yet settled. */
  settlement: SalarySettlement | null;
}

export interface SettleSalaryPayload {
  /** YYYY-MM — the month being closed out. */
  period_month: string;
  amount_paid: number;
  note?: string | null;
}

export interface SetSalaryPayload {
  monthly_salary: number;
  /** YYYY-MM — the first month the salary applies to. */
  effective_month: string;
  note?: string | null;
}

export interface CreateSalaryEntryPayload {
  entry_type: SalaryEntryType;
  amount: number;
  entry_date: string;
  /** YYYY-MM — the salary month it comes out of. */
  period_month: string;
  description?: string | null;
}
