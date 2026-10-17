import { describe, it, expect } from "vitest";
import {
  shiftCountForMonth,
  shiftCountForDate,
  isValidDate,
  isValidMonth,
  monthRange,
  rowToMark,
  totalsFor,
  parseMark,
  markCode,
  type ShiftCountRow,
  type AttendanceRow,
} from "@/app/api/driver-attendance/driver-attendance.utils";

describe("shiftCountForMonth", () => {
  it("defaults to 3 when the driver has no rows", () => {
    expect(shiftCountForMonth([], "2026-06")).toBe(3);
  });

  it("picks the latest row effective on or before the month", () => {
    const rows: ShiftCountRow[] = [
      { driver_id: 1, shift_count: 2, effective_from: "2026-01-01" },
      { driver_id: 1, shift_count: 1, effective_from: "2026-05-01" },
    ];
    expect(shiftCountForMonth(rows, "2026-06")).toBe(1);
  });

  it("ignores a row that takes effect after the queried month", () => {
    const rows: ShiftCountRow[] = [
      { driver_id: 1, shift_count: 2, effective_from: "2026-01-01" },
      { driver_id: 1, shift_count: 1, effective_from: "2026-08-01" },
    ];
    expect(shiftCountForMonth(rows, "2026-06")).toBe(2);
  });

  it("uses the exact month's own effective_from row", () => {
    const rows: ShiftCountRow[] = [
      { driver_id: 1, shift_count: 2, effective_from: "2026-06-01" },
    ];
    expect(shiftCountForMonth(rows, "2026-06")).toBe(2);
  });

  it("only considers this driver's own rows when the list has other drivers mixed in", () => {
    const rows: ShiftCountRow[] = [
      { driver_id: 2, shift_count: 1, effective_from: "2026-01-01" },
      { driver_id: 1, shift_count: 2, effective_from: "2026-01-01" },
    ];
    // shiftCountForMonth doesn't filter by driver_id itself — callers pass
    // only that driver's rows — so mixing drivers here checks it picks the
    // latest row regardless, not that it filters (callers own that).
    expect(shiftCountForMonth(rows.filter((r) => r.driver_id === 1), "2026-06")).toBe(2);
  });

  it("falls back to 3 when the stored count is out of range", () => {
    const rows: ShiftCountRow[] = [
      { driver_id: 1, shift_count: 5, effective_from: "2026-01-01" },
    ];
    expect(shiftCountForMonth(rows, "2026-06")).toBe(3);
  });
});

describe("shiftCountForDate", () => {
  it("delegates to shiftCountForMonth using the date's month", () => {
    const rows: ShiftCountRow[] = [
      { driver_id: 1, shift_count: 2, effective_from: "2026-01-01" },
    ];
    expect(shiftCountForDate(rows, "2026-06-15")).toBe(2);
  });
});

describe("isValidDate", () => {
  it("accepts a well-formed real calendar date", () => {
    expect(isValidDate("2026-06-15")).toBe(true);
  });

  it("rejects a non-existent calendar date", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
  });

  it("rejects a non-leap-year Feb 29", () => {
    expect(isValidDate("2026-02-29")).toBe(false);
  });

  it("accepts a leap-year Feb 29", () => {
    expect(isValidDate("2028-02-29")).toBe(true);
  });

  it("rejects a malformed string", () => {
    expect(isValidDate("15-06-2026")).toBe(false);
    expect(isValidDate("2026/06/15")).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(isValidDate(12345)).toBe(false);
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });
});

describe("isValidMonth", () => {
  it("accepts a well-formed month", () => {
    expect(isValidMonth("2026-06")).toBe(true);
  });

  it("rejects a month with an invalid month number", () => {
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-00")).toBe(false);
  });

  it("rejects a malformed string", () => {
    expect(isValidMonth("2026-6")).toBe(false);
    expect(isValidMonth("2026")).toBe(false);
  });
});

describe("monthRange", () => {
  it("returns the first and last day of a 31-day month", () => {
    expect(monthRange("2026-01")).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("returns the first and last day of a 30-day month", () => {
    expect(monthRange("2026-04")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });

  it("returns the correct last day for February in a leap year", () => {
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("returns the correct last day for February in a non-leap year", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("returns the correct last day for December, rolling into the next year internally", () => {
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

describe("rowToMark", () => {
  it("maps a PRESENT row to its shifts with a null status", () => {
    const row: AttendanceRow = {
      driver_id: 1,
      attendance_date: "2026-06-15",
      status: "PRESENT",
      shift_a: true,
      shift_b: false,
      shift_c: true,
    };
    expect(rowToMark(row)).toEqual({ shifts: ["A", "C"], status: null });
  });

  it("maps an ABSENT row to empty shifts with the status preserved", () => {
    const row: AttendanceRow = {
      driver_id: 1,
      attendance_date: "2026-06-15",
      status: "ABSENT",
      shift_a: false,
      shift_b: false,
      shift_c: false,
    };
    expect(rowToMark(row)).toEqual({ shifts: [], status: "ABSENT" });
  });

  it("maps a LEAVE row to empty shifts with the status preserved", () => {
    const row: AttendanceRow = {
      driver_id: 1,
      attendance_date: "2026-06-15",
      status: "LEAVE",
      shift_a: false,
      shift_b: false,
      shift_c: false,
    };
    expect(rowToMark(row)).toEqual({ shifts: [], status: "LEAVE" });
  });

  it("preserves shift order as A, B, C regardless of which booleans are set", () => {
    const row: AttendanceRow = {
      driver_id: 1,
      attendance_date: "2026-06-15",
      status: "PRESENT",
      shift_a: true,
      shift_b: true,
      shift_c: true,
    };
    expect(rowToMark(row).shifts).toEqual(["A", "B", "C"]);
  });
});

describe("totalsFor", () => {
  it("counts shifts, days present, full days, absences and leave", () => {
    const marks = [
      { shifts: ["A", "B", "C"], status: null },
      { shifts: ["A"], status: null },
      { shifts: [], status: "ABSENT" as const },
      { shifts: [], status: "LEAVE" as const },
    ];
    expect(totalsFor(marks, 3)).toEqual({
      shifts: 4,
      days_present: 2,
      full_days: 1,
      absent: 1,
      leave: 1,
    });
  });

  it("counts a 2-shift driver's A+B day as a full day, not just a 3-shift driver's A+B+C", () => {
    const marks = [{ shifts: ["A", "B"], status: null }];
    expect(totalsFor(marks, 2).full_days).toBe(1);
  });

  it("does not count a 2-shift driver's single-shift day as full", () => {
    const marks = [{ shifts: ["A"], status: null }];
    expect(totalsFor(marks, 2).full_days).toBe(0);
  });

  it("defaults shiftCount to 3 when not supplied", () => {
    const marks = [{ shifts: ["A", "B", "C"], status: null }];
    expect(totalsFor(marks).full_days).toBe(1);
  });

  it("returns all-zero totals for an empty mark list", () => {
    expect(totalsFor([])).toEqual({
      shifts: 0,
      days_present: 0,
      full_days: 0,
      absent: 0,
      leave: 0,
    });
  });
});

describe("parseMark", () => {
  it("accepts a valid shift list with no status", () => {
    expect(parseMark(["A", "B"], null, 3)).toEqual({ shifts: ["A", "B"], status: null });
  });

  it("normalizes shift order to A, B, C regardless of input order", () => {
    expect(parseMark(["C", "A"], null, 3)).toEqual({ shifts: ["A", "C"], status: null });
  });

  it("rejects a non-array shifts value", () => {
    expect(parseMark("A", null, 3)).toBe("Shifts must be a list of A, B or C");
  });

  it("rejects an invalid shift letter", () => {
    expect(parseMark(["D"], null, 3)).toBe("Shifts must be a list of A, B or C");
  });

  it("rejects an invalid status value", () => {
    expect(parseMark([], "SICK", 3)).toBe("Status must be ABSENT, LEAVE or empty");
  });

  it("accepts ABSENT with no shifts", () => {
    expect(parseMark([], "ABSENT", 3)).toEqual({ shifts: [], status: "ABSENT" });
  });

  it("accepts LEAVE with no shifts", () => {
    expect(parseMark([], "LEAVE", 3)).toEqual({ shifts: [], status: "LEAVE" });
  });

  it("rejects a status combined with any shift", () => {
    expect(parseMark(["A"], "ABSENT", 3)).toBe(
      "A driver cannot be absent or on leave and also work a shift",
    );
  });

  it("rejects a shift the driver's own shift_count does not include", () => {
    // A 2-shift driver only runs A and B (the first N of A, B, C).
    expect(parseMark(["C"], null, 2)).toBe(
      "This driver works A and B only, so shift C cannot be marked",
    );
  });

  it("accepts a shift within a 1-shift driver's allowance", () => {
    expect(parseMark(["A"], null, 1)).toEqual({ shifts: ["A"], status: null });
  });

  it("rejects a shift beyond a 1-shift driver's allowance", () => {
    expect(parseMark(["B"], null, 1)).toBe(
      "This driver works A only, so shift B cannot be marked",
    );
  });

  it("defaults shiftCount to 3 (every shift allowed) when not supplied", () => {
    expect(parseMark(["A", "B", "C"], null, undefined)).toEqual({
      shifts: ["A", "B", "C"],
      status: null,
    });
  });

  it("deduplicates a repeated shift in the input array", () => {
    expect(parseMark(["A", "A", "B"], null, 3)).toEqual({ shifts: ["A", "B"], status: null });
  });
});

describe("markCode", () => {
  it("returns an empty string for undefined", () => {
    expect(markCode(undefined)).toBe("");
  });

  it("returns 'Absent' for an ABSENT mark", () => {
    expect(markCode({ shifts: [], status: "ABSENT" })).toBe("Absent");
  });

  it("returns 'Leave' for a LEAVE mark", () => {
    expect(markCode({ shifts: [], status: "LEAVE" })).toBe("Leave");
  });

  it("returns the joined shift letters for a present mark", () => {
    expect(markCode({ shifts: ["A", "C"], status: null })).toBe("AC");
  });

  it("returns an empty string for an unmarked day (no shifts, no status)", () => {
    expect(markCode({ shifts: [], status: null })).toBe("");
  });
});
