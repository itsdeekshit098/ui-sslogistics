import { describe, it, expect } from "vitest";
import {
  daysInMonth,
  elapsedDays,
  salaryForMonth,
  sumLiveEntries,
  carryForwardIn,
  computeMonthlyPay,
  computePerTripPay,
  payTypeForMonth,
  tripCountForMonth,
  totalsFor,
  moneyMessage,
  moneyProblem,
  MAX_SALARY_AMOUNT,
  type RateRow,
  type EntryRow,
} from "@/app/api/driver-salaries/driver-salaries.utils";
import type { SalaryRow } from "@/components/salariesPage/salariesPage.types";

describe("daysInMonth", () => {
  it("returns 31 for a 31-day month", () => {
    expect(daysInMonth("2026-01")).toBe(31);
  });

  it("returns 30 for a 30-day month", () => {
    expect(daysInMonth("2026-04")).toBe(30);
  });

  it("returns 28 for February in a non-leap year", () => {
    expect(daysInMonth("2026-02")).toBe(28);
  });

  it("returns 29 for February in a leap year", () => {
    expect(daysInMonth("2028-02")).toBe(29);
  });
});

describe("elapsedDays", () => {
  it("returns 0 for a future month", () => {
    expect(elapsedDays("2026-08", "2026-06-15")).toBe(0);
  });

  it("returns the full month length once the month has fully passed", () => {
    expect(elapsedDays("2026-06", "2026-07-01")).toBe(30);
  });

  it("returns the day-of-month for the current, in-progress month", () => {
    expect(elapsedDays("2026-06", "2026-06-15")).toBe(15);
  });

  it("returns the full month length on the month's own last day", () => {
    expect(elapsedDays("2026-06", "2026-06-30")).toBe(30);
  });

  it("returns 1 on the first day of the month", () => {
    expect(elapsedDays("2026-06", "2026-06-01")).toBe(1);
  });
});

describe("salaryForMonth", () => {
  it("returns null when no rate has ever been set", () => {
    expect(salaryForMonth([], "2026-06")).toBeNull();
  });

  it("picks the latest rate effective on or before the month", () => {
    const rates: RateRow[] = [
      { monthly_salary: 15000, effective_from: "2026-01-01" },
      { monthly_salary: 18000, effective_from: "2026-05-01" },
    ];
    expect(salaryForMonth(rates, "2026-06")).toBe(18000);
  });

  it("does not let a later raise rewrite an earlier month", () => {
    const rates: RateRow[] = [
      { monthly_salary: 15000, effective_from: "2026-01-01" },
      { monthly_salary: 18000, effective_from: "2026-05-01" },
    ];
    expect(salaryForMonth(rates, "2026-03")).toBe(15000);
  });

  it("returns null for a month before any rate existed", () => {
    const rates: RateRow[] = [{ monthly_salary: 15000, effective_from: "2026-05-01" }];
    expect(salaryForMonth(rates, "2026-01")).toBeNull();
  });

  it("coerces a string monthly_salary to a number", () => {
    const rates: RateRow[] = [{ monthly_salary: "15000", effective_from: "2026-01-01" }];
    expect(salaryForMonth(rates, "2026-06")).toBe(15000);
  });
});

describe("sumLiveEntries", () => {
  it("sums advances and deductions separately", () => {
    const entries: EntryRow[] = [
      { id: 1, entry_type: "ADVANCE", amount: 1000, reverses_entry_id: null },
      { id: 2, entry_type: "DEDUCTION", amount: 200, reverses_entry_id: null },
      { id: 3, entry_type: "ADVANCE", amount: 500, reverses_entry_id: null },
    ];
    expect(sumLiveEntries(entries)).toEqual({ advances: 1500, deductions: 200 });
  });

  it("excludes a reversed entry and its reversal — the pair nets to zero", () => {
    const entries: EntryRow[] = [
      { id: 1, entry_type: "ADVANCE", amount: 1000, reverses_entry_id: null },
      { id: 2, entry_type: "ADVANCE", amount: -1000, reverses_entry_id: 1 },
    ];
    expect(sumLiveEntries(entries)).toEqual({ advances: 0, deductions: 0 });
  });

  it("still counts an entry that was never reversed, alongside a separate reversed pair", () => {
    const entries: EntryRow[] = [
      { id: 1, entry_type: "ADVANCE", amount: 1000, reverses_entry_id: null },
      { id: 2, entry_type: "ADVANCE", amount: -1000, reverses_entry_id: 1 },
      { id: 3, entry_type: "DEDUCTION", amount: 300, reverses_entry_id: null },
    ];
    expect(sumLiveEntries(entries)).toEqual({ advances: 0, deductions: 300 });
  });

  it("returns zero totals for an empty entry list", () => {
    expect(sumLiveEntries([])).toEqual({ advances: 0, deductions: 0 });
  });

  it("coerces a string amount to a number", () => {
    const entries: EntryRow[] = [
      { id: 1, entry_type: "ADVANCE", amount: "1000", reverses_entry_id: null },
    ];
    expect(sumLiveEntries(entries).advances).toBe(1000);
  });
});

describe("carryForwardIn", () => {
  it("returns 0 when nothing is tagged with a settlement", () => {
    const entries: EntryRow[] = [
      { id: 1, entry_type: "ADVANCE", amount: 1000, reverses_entry_id: null },
    ];
    expect(carryForwardIn(entries)).toBe(0);
  });

  it("reports an overpayment carry-forward (ADVANCE) as positive", () => {
    const entries: EntryRow[] = [
      { id: 1, entry_type: "ADVANCE", amount: 2000, reverses_entry_id: null, settlement_id: 9 },
    ];
    expect(carryForwardIn(entries)).toBe(2000);
  });

  it("reports an underpayment carry-forward (DEDUCTION) as negative", () => {
    const entries: EntryRow[] = [
      { id: 1, entry_type: "DEDUCTION", amount: 1500, reverses_entry_id: null, settlement_id: 9 },
    ];
    expect(carryForwardIn(entries)).toBe(-1500);
  });

  it("excludes a carry-forward entry that was reversed (settlement undone)", () => {
    const entries: EntryRow[] = [
      { id: 1, entry_type: "ADVANCE", amount: 2000, reverses_entry_id: null, settlement_id: 9 },
      { id: 2, entry_type: "ADVANCE", amount: -2000, reverses_entry_id: 1, settlement_id: null },
    ];
    expect(carryForwardIn(entries)).toBe(0);
  });

  it("ignores a plain manual entry alongside a tagged carry-forward", () => {
    const entries: EntryRow[] = [
      { id: 1, entry_type: "ADVANCE", amount: 2000, reverses_entry_id: null, settlement_id: 9 },
      { id: 2, entry_type: "ADVANCE", amount: 500, reverses_entry_id: null },
    ];
    expect(carryForwardIn(entries)).toBe(2000);
  });
});

describe("computeMonthlyPay", () => {
  it("returns net_pay=null and attendance_cut=0 when no salary has been set", () => {
    const result = computeMonthlyPay({
      monthlySalary: null,
      daysInMonth: 30,
      absentDays: 2,
      leaveDays: 0,
      advances: 0,
      deductions: 0,
    });
    expect(result).toEqual({ unpaid_days: 2, attendance_cut: 0, net_pay: null });
  });

  it("charges nothing for a perfect-attendance month", () => {
    const result = computeMonthlyPay({
      monthlySalary: 30000,
      daysInMonth: 30,
      absentDays: 0,
      leaveDays: 0,
      advances: 0,
      deductions: 0,
    });
    expect(result).toEqual({ unpaid_days: 0, attendance_cut: 0, net_pay: 30000 });
  });

  it("cuts day's-pay-times-unpaid-days, rounded to the rupee", () => {
    const result = computeMonthlyPay({
      monthlySalary: 30000,
      daysInMonth: 30,
      absentDays: 2,
      leaveDays: 0,
      advances: 0,
      deductions: 0,
    });
    // day's pay = 1000; cut = 1000 * 2 = 2000
    expect(result.attendance_cut).toBe(2000);
    expect(result.net_pay).toBe(28000);
  });

  it("treats leave the same as absent — both are unpaid", () => {
    const withLeave = computeMonthlyPay({
      monthlySalary: 30000,
      daysInMonth: 30,
      absentDays: 0,
      leaveDays: 2,
      advances: 0,
      deductions: 0,
    });
    const withAbsent = computeMonthlyPay({
      monthlySalary: 30000,
      daysInMonth: 30,
      absentDays: 2,
      leaveDays: 0,
      advances: 0,
      deductions: 0,
    });
    expect(withLeave.attendance_cut).toBe(withAbsent.attendance_cut);
  });

  it("combines absent and leave days for the cut", () => {
    const result = computeMonthlyPay({
      monthlySalary: 30000,
      daysInMonth: 30,
      absentDays: 1,
      leaveDays: 1,
      advances: 0,
      deductions: 0,
    });
    expect(result.unpaid_days).toBe(2);
    expect(result.attendance_cut).toBe(2000);
  });

  it("caps the attendance cut at the monthly salary — cannot exceed 100%", () => {
    const result = computeMonthlyPay({
      monthlySalary: 30000,
      daysInMonth: 30,
      absentDays: 30,
      leaveDays: 10, // 40 unpaid days against a 30-day month would overshoot without the cap
      advances: 0,
      deductions: 0,
    });
    expect(result.attendance_cut).toBe(30000);
    expect(result.net_pay).toBe(0 - 0 - 0); // salary - cut(=salary) - 0 - 0
  });

  it("subtracts advances and deductions from net pay", () => {
    const result = computeMonthlyPay({
      monthlySalary: 30000,
      daysInMonth: 30,
      absentDays: 0,
      leaveDays: 0,
      advances: 5000,
      deductions: 1000,
    });
    expect(result.net_pay).toBe(24000);
  });

  it("allows net pay to go negative when advances exceed what was earned", () => {
    const result = computeMonthlyPay({
      monthlySalary: 10000,
      daysInMonth: 30,
      absentDays: 0,
      leaveDays: 0,
      advances: 15000,
      deductions: 0,
    });
    expect(result.net_pay).toBe(-5000);
  });

  it("rounds a fractional cut to the nearest rupee", () => {
    // day's pay = 30000/31 ≈ 967.74; cut for 1 day ≈ 968 (rounds up)
    const result = computeMonthlyPay({
      monthlySalary: 30000,
      daysInMonth: 31,
      absentDays: 1,
      leaveDays: 0,
      advances: 0,
      deductions: 0,
    });
    expect(result.attendance_cut).toBe(968);
  });

  it("an unmarked day costs nothing — only explicit absent/leave reduce pay", () => {
    // unpaid_days only comes from absentDays + leaveDays; a day with no mark
    // at all never appears in either count, so it's implicitly paid.
    const result = computeMonthlyPay({
      monthlySalary: 30000,
      daysInMonth: 30,
      absentDays: 0,
      leaveDays: 0,
      advances: 0,
      deductions: 0,
    });
    expect(result.attendance_cut).toBe(0);
  });
});

describe("computePerTripPay", () => {
  it("returns net_pay=null when the rate is not set", () => {
    expect(computePerTripPay({ ratePerTrip: null, tripCount: 10, advances: 0, deductions: 0 })).toEqual({
      net_pay: null,
    });
  });

  it("returns net_pay=null when the trip count has not been entered", () => {
    expect(computePerTripPay({ ratePerTrip: 500, tripCount: null, advances: 0, deductions: 0 })).toEqual({
      net_pay: null,
    });
  });

  it("multiplies rate by trip count", () => {
    expect(
      computePerTripPay({ ratePerTrip: 500, tripCount: 40, advances: 0, deductions: 0 }),
    ).toEqual({ net_pay: 20000 });
  });

  it("subtracts advances and deductions, same as the monthly rule", () => {
    expect(
      computePerTripPay({ ratePerTrip: 500, tripCount: 40, advances: 2000, deductions: 500 }),
    ).toEqual({ net_pay: 17500 });
  });

  it("allows net pay to go negative when advances exceed what was earned", () => {
    expect(
      computePerTripPay({ ratePerTrip: 500, tripCount: 2, advances: 5000, deductions: 0 }),
    ).toEqual({ net_pay: -4000 });
  });

  it("has no per-day attendance cut at all — a zero trip count is simply zero pay", () => {
    expect(
      computePerTripPay({ ratePerTrip: 500, tripCount: 0, advances: 0, deductions: 0 }),
    ).toEqual({ net_pay: 0 });
  });
});

describe("payTypeForMonth", () => {
  it("defaults to MONTHLY with no rate when nothing has been set", () => {
    expect(payTypeForMonth([], "2026-06")).toEqual({ payType: "MONTHLY", ratePerTrip: null });
  });

  it("picks the latest row effective on or before the month", () => {
    const rows = [
      { pay_type: "MONTHLY", rate_per_trip: null, effective_from: "2026-01-01" },
      { pay_type: "PER_TRIP", rate_per_trip: 500, effective_from: "2026-05-01" },
    ];
    expect(payTypeForMonth(rows, "2026-06")).toEqual({ payType: "PER_TRIP", ratePerTrip: 500 });
  });

  it("does not let a later switch rewrite an earlier month", () => {
    const rows = [
      { pay_type: "MONTHLY", rate_per_trip: null, effective_from: "2026-01-01" },
      { pay_type: "PER_TRIP", rate_per_trip: 500, effective_from: "2026-05-01" },
    ];
    expect(payTypeForMonth(rows, "2026-03")).toEqual({ payType: "MONTHLY", ratePerTrip: null });
  });

  it("coerces a string rate_per_trip to a number", () => {
    const rows = [{ pay_type: "PER_TRIP", rate_per_trip: "500", effective_from: "2026-01-01" }];
    expect(payTypeForMonth(rows, "2026-06")).toEqual({ payType: "PER_TRIP", ratePerTrip: 500 });
  });

  it("switching back to MONTHLY from a later month reads as MONTHLY", () => {
    const rows = [
      { pay_type: "PER_TRIP", rate_per_trip: 500, effective_from: "2026-01-01" },
      { pay_type: "MONTHLY", rate_per_trip: null, effective_from: "2026-05-01" },
    ];
    expect(payTypeForMonth(rows, "2026-06")).toEqual({ payType: "MONTHLY", ratePerTrip: null });
  });
});

describe("tripCountForMonth", () => {
  it("returns null when nothing was entered for the month", () => {
    expect(tripCountForMonth([], "2026-06")).toBeNull();
  });

  it("reads the count for exactly that month only", () => {
    const rows = [
      { period_month: "2026-05-01", trip_count: 30 },
      { period_month: "2026-06-01", trip_count: 42 },
    ];
    expect(tripCountForMonth(rows, "2026-06")).toBe(42);
    expect(tripCountForMonth(rows, "2026-05")).toBe(30);
  });

  it("coerces a string trip_count to a number", () => {
    const rows = [{ period_month: "2026-06-01", trip_count: "42" }];
    expect(tripCountForMonth(rows, "2026-06")).toBe(42);
  });
});

describe("totalsFor", () => {
  const row = (overrides: Partial<SalaryRow>): SalaryRow =>
    ({
      driver_id: 1,
      name: "Ravi",
      monthly_salary: 30000,
      attendance_cut: 1000,
      advances: 500,
      deductions: 200,
      net_pay: 28300,
      ...overrides,
    }) as SalaryRow;

  it("sums figures across multiple rows with salaries set", () => {
    const rows = [row({}), row({ monthly_salary: 20000, attendance_cut: 0, advances: 0, deductions: 0, net_pay: 20000 })];
    const totals = totalsFor(rows);
    expect(totals.monthly_salary).toBe(50000);
    expect(totals.net_pay).toBe(48300);
    expect(totals.drivers_without_salary).toBe(0);
  });

  it("counts a driver with no salary set apart, without adding to the sums", () => {
    const rows = [row({}), row({ monthly_salary: null, net_pay: null })];
    const totals = totalsFor(rows);
    expect(totals.drivers_without_salary).toBe(1);
    expect(totals.monthly_salary).toBe(30000);
  });

  it("counts a PER_TRIP row's net pay even though monthly_salary is null", () => {
    // A PER_TRIP driver never has a monthly_salary — only net_pay being null
    // means "nothing to work from yet", so a fully-configured trip-paid
    // driver must still land in the totals.
    const rows = [row({ monthly_salary: null, net_pay: 20000 })];
    const totals = totalsFor(rows);
    expect(totals.drivers_without_salary).toBe(0);
    expect(totals.net_pay).toBe(20000);
    expect(totals.monthly_salary).toBe(0);
  });

  it("returns all-zero totals for an empty row list", () => {
    const totals = totalsFor([]);
    expect(totals).toEqual({
      monthly_salary: 0,
      attendance_cut: 0,
      advances: 0,
      deductions: 0,
      net_pay: 0,
      drivers_without_salary: 0,
    });
  });
});

describe("moneyProblem", () => {
  it("accepts ordinary rupee and paisa amounts", () => {
    expect(moneyProblem(30000)).toBeNull();
    expect(moneyProblem(1200.5)).toBeNull();
    expect(moneyProblem(0.07)).toBeNull();
    expect(moneyProblem(MAX_SALARY_AMOUNT)).toBeNull();
  });

  it("rejects anything that isn't a finite number", () => {
    for (const bad of ["500", null, undefined, NaN, Infinity, -Infinity, [], {}, true]) {
      expect(moneyProblem(bad)).toBe("invalid");
    }
  });

  it("rejects zero and negatives unless zero is allowed", () => {
    expect(moneyProblem(0)).toBe("invalid");
    expect(moneyProblem(-5)).toBe("invalid");
    expect(moneyProblem(0, true)).toBeNull();
    expect(moneyProblem(-0.01, true)).toBe("invalid");
  });

  it("rejects an amount above the ceiling, so a typo can't corrupt every total", () => {
    expect(moneyProblem(MAX_SALARY_AMOUNT + 1)).toBe("too_large");
    expect(moneyProblem(1e20)).toBe("too_large");
  });

  it("rejects fractions of a paisa", () => {
    expect(moneyProblem(10.555)).toBe("too_precise");
    expect(moneyProblem(30000.001)).toBe("too_precise");
  });
});

describe("moneyMessage", () => {
  it("uses the caller's wording only for an invalid value", () => {
    expect(moneyMessage("invalid", "Enter an amount")).toBe("Enter an amount");
    expect(moneyMessage("too_large", "Enter an amount")).toMatch(/too large/);
    expect(moneyMessage("too_precise", "Enter an amount")).toMatch(/2 decimal places/);
  });
});
