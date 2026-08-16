import { describe, it, expect } from "vitest";
import {
  generateSchedule,
  toDateString,
  parseDate,
  isValidDateString,
  isNonNegativeNumber,
  isPositiveNumber,
} from "@/app/api/loans/loans.utils";

describe("parseDate / toDateString", () => {
  it("round-trips a date string through UTC midnight", () => {
    expect(toDateString(parseDate("2026-03-15"))).toBe("2026-03-15");
  });

  it("does not drift across a local-timezone boundary", () => {
    // The whole point of going via Date.UTC is that this holds regardless of
    // the host machine's timezone.
    const d = parseDate("2026-01-01");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(1);
  });
});

describe("isValidDateString", () => {
  it("accepts a well-formed calendar date", () => {
    expect(isValidDateString("2026-08-16")).toBe(true);
  });

  it("rejects a day that doesn't exist, e.g. 31 Feb", () => {
    expect(isValidDateString("2026-02-31")).toBe(false);
  });

  it("accepts 29 Feb on a leap year and rejects it otherwise", () => {
    expect(isValidDateString("2024-02-29")).toBe(true);
    expect(isValidDateString("2026-02-29")).toBe(false);
  });

  it("rejects non-string and malformed input", () => {
    expect(isValidDateString(20260816)).toBe(false);
    expect(isValidDateString("16-08-2026")).toBe(false);
    expect(isValidDateString(null)).toBe(false);
    expect(isValidDateString(undefined)).toBe(false);
  });
});

describe("isNonNegativeNumber / isPositiveNumber", () => {
  it("accepts zero only for non-negative", () => {
    expect(isNonNegativeNumber(0)).toBe(true);
    expect(isPositiveNumber(0)).toBe(false);
  });

  it("rejects negative, NaN, and non-numeric strings", () => {
    expect(isNonNegativeNumber(-1)).toBe(false);
    expect(isNonNegativeNumber(NaN)).toBe(false);
    expect(isNonNegativeNumber("abc")).toBe(false);
    expect(isPositiveNumber(-5)).toBe(false);
  });

  it("coerces numeric strings, matching how JSON body values arrive", () => {
    expect(isNonNegativeNumber("100.50")).toBe(true);
    expect(isPositiveNumber("0.01")).toBe(true);
  });
});

describe("generateSchedule", () => {
  it("keeps the first installment on the exact date given, even off-mandate", () => {
    const rows = generateSchedule({
      firstEmiDate: "2026-01-17",
      emiDayOfMonth: 5,
      emiAmount: 10000,
      totalInstallments: 1,
    });
    expect(rows).toEqual([
      { installment_no: 1, due_date: "2026-01-17", amount_due: 10000 },
    ]);
  });

  it("settles subsequent installments onto the mandate day", () => {
    const rows = generateSchedule({
      firstEmiDate: "2026-01-17",
      emiDayOfMonth: 5,
      emiAmount: 10000,
      totalInstallments: 3,
    });
    expect(rows.map((r) => r.due_date)).toEqual([
      "2026-01-17",
      "2026-02-05",
      "2026-03-05",
    ]);
  });

  it("clamps day-31 into February and returns to 31 in March, without spilling into April", () => {
    const rows = generateSchedule({
      firstEmiDate: "2026-01-31",
      emiDayOfMonth: 31,
      emiAmount: 5000,
      totalInstallments: 4,
    });
    // 2026 is not a leap year, so Feb clamps to 28.
    expect(rows.map((r) => r.due_date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("clamps to 29 in February during a leap year", () => {
    const rows = generateSchedule({
      firstEmiDate: "2024-01-31",
      emiDayOfMonth: 31,
      emiAmount: 5000,
      totalInstallments: 2,
    });
    expect(rows.map((r) => r.due_date)).toEqual(["2024-01-31", "2024-02-29"]);
  });

  it("numbers installments sequentially and repeats the given amount", () => {
    const rows = generateSchedule({
      firstEmiDate: "2026-06-01",
      emiDayOfMonth: 1,
      emiAmount: 25000,
      totalInstallments: 3,
    });
    expect(rows.map((r) => r.installment_no)).toEqual([1, 2, 3]);
    expect(rows.every((r) => r.amount_due === 25000)).toBe(true);
  });

  it("returns an empty schedule for zero installments", () => {
    expect(
      generateSchedule({
        firstEmiDate: "2026-06-01",
        emiDayOfMonth: 1,
        emiAmount: 25000,
        totalInstallments: 0,
      }),
    ).toEqual([]);
  });
});
