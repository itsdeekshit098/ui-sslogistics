import { describe, it, expect } from "vitest";
import {
  computePay,
  daysInMonth,
  elapsedDays,
  salaryForMonth,
  sumLiveEntries,
  totalsFor,
} from "@/app/api/driver-salaries/driver-salaries.utils";
import type { SalaryRow } from "@/components/salariesPage/salariesPage.types";

describe("daysInMonth / elapsedDays", () => {
  it("counts calendar days, including a leap February", () => {
    expect(daysInMonth("2026-10")).toBe(31);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
  });

  it("counts the days of a month that have happened by today", () => {
    expect(elapsedDays("2026-10", "2026-10-12")).toBe(12);
    expect(elapsedDays("2026-09", "2026-10-12")).toBe(30);
    expect(elapsedDays("2026-10", "2026-10-31")).toBe(31);
    expect(elapsedDays("2026-11", "2026-10-12")).toBe(0);
  });
});

describe("salaryForMonth", () => {
  const rates = [
    { monthly_salary: 18000, effective_from: "2026-01-01" },
    { monthly_salary: 20000, effective_from: "2026-06-01" },
  ];

  it("uses the latest salary that had taken effect by that month", () => {
    expect(salaryForMonth(rates, "2026-03")).toBe(18000);
    expect(salaryForMonth(rates, "2026-06")).toBe(20000);
    expect(salaryForMonth(rates, "2026-12")).toBe(20000);
  });

  it("keeps an earlier month on its old salary after a raise", () => {
    expect(salaryForMonth(rates, "2026-05")).toBe(18000);
  });

  it("is null before any salary was set, or when none ever was", () => {
    expect(salaryForMonth(rates, "2025-12")).toBeNull();
    expect(salaryForMonth([], "2026-06")).toBeNull();
  });

  it("reads a numeric that arrives as a string", () => {
    expect(salaryForMonth([{ monthly_salary: "15500", effective_from: "2026-01-01" }], "2026-02")).toBe(15500);
  });
});

describe("sumLiveEntries", () => {
  it("totals advances and deductions separately", () => {
    expect(
      sumLiveEntries([
        { id: 1, entry_type: "ADVANCE", amount: 2000, reverses_entry_id: null },
        { id: 2, entry_type: "ADVANCE", amount: 500, reverses_entry_id: null },
        { id: 3, entry_type: "DEDUCTION", amount: 300, reverses_entry_id: null },
      ]),
    ).toEqual({ advances: 2500, deductions: 300 });
  });

  it("drops both a reversed entry and the reversal that cancels it", () => {
    expect(
      sumLiveEntries([
        { id: 1, entry_type: "ADVANCE", amount: 2000, reverses_entry_id: null },
        { id: 2, entry_type: "ADVANCE", amount: 2000, reverses_entry_id: 1 },
        { id: 3, entry_type: "ADVANCE", amount: 700, reverses_entry_id: null },
      ]),
    ).toEqual({ advances: 700, deductions: 0 });
  });
});

describe("computePay", () => {
  const base = {
    monthlySalary: 31000,
    daysInMonth: 31,
    absentDays: 0,
    leaveDays: 0,
    advances: 0,
    deductions: 0,
  };

  it("pays the full salary for a month with no absence", () => {
    expect(computePay(base)).toEqual({ unpaid_days: 0, attendance_cut: 0, net_pay: 31000 });
  });

  it("cuts a day's pay for each absent day", () => {
    expect(computePay({ ...base, absentDays: 2 })).toEqual({
      unpaid_days: 2,
      attendance_cut: 2000,
      net_pay: 29000,
    });
  });

  it("treats leave as unpaid, the same as absent", () => {
    expect(computePay({ ...base, absentDays: 1, leaveDays: 2 })).toEqual({
      unpaid_days: 3,
      attendance_cut: 3000,
      net_pay: 28000,
    });
  });

  it("divides by the days in that month, so a day costs more in February", () => {
    expect(computePay({ ...base, monthlySalary: 28000, daysInMonth: 28, absentDays: 1 }).attendance_cut).toBe(1000);
    expect(computePay({ ...base, monthlySalary: 28000, daysInMonth: 31, absentDays: 1 }).attendance_cut).toBe(903);
  });

  it("rounds the cut to the rupee", () => {
    // 20000 / 31 * 3 = 1935.48…
    expect(computePay({ ...base, monthlySalary: 20000, absentDays: 3 }).attendance_cut).toBe(1935);
  });

  it("takes advances and deductions off after the attendance cut", () => {
    expect(computePay({ ...base, absentDays: 1, advances: 5000, deductions: 750 }).net_pay).toBe(24250);
  });

  it("never cuts more than the salary, even if every day was absent", () => {
    expect(computePay({ ...base, absentDays: 31 })).toEqual({
      unpaid_days: 31,
      attendance_cut: 31000,
      net_pay: 0,
    });
  });

  it("lets net pay go negative when advances outrun what was earned", () => {
    expect(computePay({ ...base, absentDays: 30, advances: 5000 }).net_pay).toBe(-4000);
  });

  it("has no pay to work out when no salary is set", () => {
    expect(computePay({ ...base, monthlySalary: null, absentDays: 2, advances: 500 })).toEqual({
      unpaid_days: 2,
      attendance_cut: 0,
      net_pay: null,
    });
  });
});

describe("totalsFor", () => {
  const row = (over: Partial<SalaryRow>): SalaryRow => ({
    driver_id: 1,
    name: "A",
    place: null,
    is_active: true,
    monthly_salary: 20000,
    days_present: 30,
    absent_days: 1,
    leave_days: 0,
    unmarked_days: 0,
    unpaid_days: 1,
    attendance_cut: 645,
    advances: 1000,
    deductions: 0,
    net_pay: 18355,
    ...over,
  });

  it("adds up the drivers that have a salary and counts the ones that don't", () => {
    const totals = totalsFor([
      row({}),
      row({ driver_id: 2, monthly_salary: 10000, attendance_cut: 0, advances: 0, deductions: 200, net_pay: 9800 }),
      row({ driver_id: 3, monthly_salary: null, attendance_cut: 0, advances: 500, net_pay: null }),
    ]);
    expect(totals).toEqual({
      monthly_salary: 30000,
      attendance_cut: 645,
      advances: 1000,
      deductions: 200,
      net_pay: 28155,
      drivers_without_salary: 1,
    });
  });
});
