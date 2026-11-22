import { describe, it, expect } from "vitest";
import {
  addDays,
  addMonths,
  addYears,
  clampToRange,
  compareISO,
  daysInMonth,
  formatDisplay,
  formatLong,
  formatMonthShort,
  formatMonthYear,
  isOutOfRange,
  monthGrid,
  monthName,
  parseISODate,
  parseISOMonth,
  toISODate,
  toISOMonth,
  weekdayNames,
  weekdayOf,
} from "@ui/components/datePicker";

describe("parseISODate", () => {
  it.each(["2026-06-15", "2024-02-29", "0999-01-01", "2026-12-31"])("accepts %s", (v) => {
    expect(parseISODate(v)).not.toBeNull();
  });

  it.each([
    "", null, undefined,
    "2026-02-30", // impossible day
    "2025-02-29", // not a leap year
    "2026-13-01", // impossible month
    "2026-00-10",
    "2026-06-00",
    "2026-6-15", // not zero-padded
    "15-06-2026", // the browser's other order
    "2026-06-15T10:00:00",
    " 2026-06-15",
  ])("rejects %j", (v) => {
    expect(parseISODate(v as string)).toBeNull();
  });

  it("round-trips through toISODate", () => {
    expect(toISODate(parseISODate("2026-06-05")!)).toBe("2026-06-05");
    expect(toISODate({ y: 999, m: 1, d: 2 })).toBe("0999-01-02");
  });
});

describe("calendar arithmetic", () => {
  it("knows month lengths, including leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("finds the weekday (0 = Sunday)", () => {
    expect(weekdayOf({ y: 2026, m: 6, d: 15 })).toBe(1); // Monday
    expect(weekdayOf({ y: 2023, m: 1, d: 1 })).toBe(0);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDays("2026-06-15", 7)).toBe("2026-06-22");
  });

  it("adds months, clamping to the shorter month's end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-06-15", 12)).toBe("2027-06-15");
  });

  it("adds years, handling 29 February", () => {
    expect(addYears("2024-02-29", 1)).toBe("2025-02-28");
    expect(addYears("2024-02-29", 4)).toBe("2028-02-29");
  });

  it("compares and ranges", () => {
    expect(compareISO("2026-06-15", "2026-06-16")).toBe(-1);
    expect(compareISO("2026-06-15", "2026-06-15")).toBe(0);
    expect(compareISO("2027-01-01", "2026-12-31")).toBe(1);
    expect(isOutOfRange("2026-06-01", "2026-06-10", "2026-06-20")).toBe(true);
    expect(isOutOfRange("2026-06-10", "2026-06-10", "2026-06-20")).toBe(false);
    expect(isOutOfRange("2026-06-21", "2026-06-10", "2026-06-20")).toBe(true);
    expect(isOutOfRange("2030-01-01")).toBe(false);
    expect(clampToRange("2026-06-01", "2026-06-10", "2026-06-20")).toBe("2026-06-10");
    expect(clampToRange("2026-07-01", "2026-06-10", "2026-06-20")).toBe("2026-06-20");
    expect(clampToRange("2026-06-15", "2026-06-10", "2026-06-20")).toBe("2026-06-15");
  });
});

describe("monthGrid", () => {
  it("is always six weeks of seven days", () => {
    for (const [y, m] of [[2026, 2], [2026, 6], [2026, 8], [2023, 10]]) {
      const grid = monthGrid(y, m);
      expect(grid).toHaveLength(6);
      expect(grid.every((w) => w.length === 7)).toBe(true);
    }
  });

  it("starts on the chosen weekday and marks the month's own days", () => {
    // June 2026 starts on a Monday.
    const sunday = monthGrid(2026, 6, 0).flat();
    expect(sunday[0]).toEqual({ iso: "2026-05-31", inMonth: false });
    expect(sunday[1]).toEqual({ iso: "2026-06-01", inMonth: true });
    const monday = monthGrid(2026, 6, 1).flat();
    expect(monday[0]).toEqual({ iso: "2026-06-01", inMonth: true });
  });

  it("contains each of the month's days exactly once", () => {
    const own = monthGrid(2026, 2).flat().filter((d) => d.inMonth);
    expect(own).toHaveLength(28);
    expect(new Set(own.map((d) => d.iso)).size).toBe(28);
  });

  it("is consecutive days with no gaps", () => {
    const days = monthGrid(2024, 2).flat().map((d) => d.iso);
    days.slice(1).forEach((iso, i) => expect(iso).toBe(addDays(days[i], 1)));
  });
});

describe("formatting (en-IN, independent of the machine's time zone)", () => {
  it("formats a date", () => {
    expect(formatDisplay("2026-06-15")).toBe("15 Jun 2026");
    expect(formatDisplay("2026-01-01")).toBe("1 Jan 2026");
    expect(formatLong("2026-06-15")).toBe("Monday, 15 June 2026");
    expect(formatMonthYear(2026, 6)).toBe("June 2026");
  });

  it("lists weekday names from the chosen start day", () => {
    expect(weekdayNames(0)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(weekdayNames(1)[0]).toBe("Mon");
    expect(weekdayNames(1)[6]).toBe("Sun");
  });

  it("parses and formats months", () => {
    expect(parseISOMonth("2026-06")).toEqual({ y: 2026, m: 6 });
    for (const bad of ["2026-13", "2026-6", "2026-06-15", "", null]) expect(parseISOMonth(bad as string)).toBeNull();
    expect(toISOMonth(2026, 6)).toBe("2026-06");
    expect(formatMonthShort("2026-06")).toBe("Jun 2026");
    expect(monthName(1)).toBe("Jan");
    expect(monthName(12)).toBe("Dec");
  });
});
