export const SALARY_ENTRY_TYPES = ["ADVANCE", "DEDUCTION"] as const;
export type SalaryEntryType = (typeof SALARY_ENTRY_TYPES)[number];

export const SALARY_DESCRIPTION_MAX_LENGTH = 300;

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
  /** Null until a salary has been set for this driver for this month or earlier. */
  monthly_salary: number | null;
  days_present: number;
  absent_days: number;
  leave_days: number;
  /** Days up to today with no attendance mark. They are paid, not cut. */
  unmarked_days: number;
  /** Absent + leave: the days a day's pay is cut for. */
  unpaid_days: number;
  attendance_cut: number;
  advances: number;
  deductions: number;
  /** Null when there is no salary to work from. Can be negative. */
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

export interface SalaryDriverDetail {
  month: string;
  days_in_month: number;
  is_provisional: boolean;
  row: SalaryRow;
  /** Newest first. */
  rates: SalaryRate[];
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
