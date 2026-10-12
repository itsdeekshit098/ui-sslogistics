import { describe, expect, it } from "vitest";
import {
  parseMark,
  shiftCountForDate,
  shiftCountForMonth,
  totalsFor,
  type ShiftCountRow,
} from "@/app/api/driver-attendance/driver-attendance.utils";
import {
  shiftsFor,
  type AttendanceMark,
} from "@/components/attendancePage/attendancePage.types";

const row = (shift_count: number, effective_from: string): ShiftCountRow => ({
  driver_id: 1,
  shift_count,
  effective_from,
});

const present = (...shifts: string[]): AttendanceMark => ({
  shifts: shifts as AttendanceMark["shifts"],
  status: null,
});

describe("shiftsFor", () => {
  it("gives the first N of A, B, C", () => {
    expect(shiftsFor(1)).toEqual(["A"]);
    expect(shiftsFor(2)).toEqual(["A", "B"]);
    expect(shiftsFor(3)).toEqual(["A", "B", "C"]);
  });
});

describe("shiftCountForMonth", () => {
  it("is three shifts when nothing has been set", () => {
    expect(shiftCountForMonth([], "2026-10")).toBe(3);
  });

  it("uses the latest row taking effect on or before the month", () => {
    const rows = [row(3, "2025-01-01"), row(2, "2026-04-01")];
    expect(shiftCountForMonth(rows, "2026-03")).toBe(3);
    expect(shiftCountForMonth(rows, "2026-04")).toBe(2);
    expect(shiftCountForMonth(rows, "2026-10")).toBe(2);
  });

  it("ignores a change dated after the month being read", () => {
    // The whole point of the dated table: setting someone to 2 shifts next
    // April must not rewrite what their January register said.
    const rows = [row(2, "2027-04-01")];
    expect(shiftCountForMonth(rows, "2026-10")).toBe(3);
  });

  it("does not depend on the order rows arrive in", () => {
    const rows = [row(1, "2026-06-01"), row(3, "2026-01-01"), row(2, "2026-03-01")];
    expect(shiftCountForMonth(rows, "2026-05")).toBe(2);
    expect(shiftCountForMonth([...rows].reverse(), "2026-05")).toBe(2);
  });

  it("falls back to three if the stored number is out of range", () => {
    expect(shiftCountForMonth([row(7, "2026-01-01")], "2026-10")).toBe(3);
  });

  it("reads a date by the month it falls in", () => {
    const rows = [row(2, "2026-04-01")];
    expect(shiftCountForDate(rows, "2026-03-31")).toBe(3);
    expect(shiftCountForDate(rows, "2026-04-01")).toBe(2);
    expect(shiftCountForDate(rows, "2026-04-30")).toBe(2);
  });
});

describe("totalsFor", () => {
  it("counts a full day against the driver's own shifts", () => {
    const marks = [present("A", "B")];
    // A two-shift driver who worked both is on a full day...
    expect(totalsFor(marks, 2).full_days).toBe(1);
    // ...but the same marks for a three-shift driver are a part day.
    expect(totalsFor(marks, 3).full_days).toBe(0);
  });

  it("treats a single shift as a full day for a one-shift driver", () => {
    expect(totalsFor([present("A")], 1).full_days).toBe(1);
    expect(totalsFor([present("A")], 2).full_days).toBe(0);
  });

  it("counts shifts, days present, absent and leave regardless of the count", () => {
    const marks: AttendanceMark[] = [
      present("A", "B"),
      present("A"),
      { shifts: [], status: "ABSENT" },
      { shifts: [], status: "LEAVE" },
    ];
    expect(totalsFor(marks, 2)).toEqual({
      shifts: 3,
      days_present: 2,
      full_days: 1,
      absent: 1,
      leave: 1,
    });
  });

  it("still assumes three shifts when no count is given", () => {
    expect(totalsFor([present("A", "B", "C")]).full_days).toBe(1);
  });
});

describe("parseMark", () => {
  it("accepts the shifts a driver actually works", () => {
    expect(parseMark(["A", "B"], null, 2)).toEqual({ shifts: ["A", "B"], status: null });
    expect(parseMark(["A"], null, 1)).toEqual({ shifts: ["A"], status: null });
  });

  it("refuses a shift the driver does not work", () => {
    // A stale screen must not be able to record a C shift for someone who
    // only runs A and B.
    expect(parseMark(["A", "C"], null, 2)).toContain("A and B only");
    expect(parseMark(["B"], null, 1)).toContain("A only");
  });

  it("still allows absent and leave for any shift count", () => {
    expect(parseMark([], "ABSENT", 1)).toEqual({ shifts: [], status: "ABSENT" });
    expect(parseMark([], "LEAVE", 2)).toEqual({ shifts: [], status: "LEAVE" });
  });

  it("refuses a shift together with absent or leave", () => {
    expect(parseMark(["A"], "ABSENT", 2)).toContain("cannot be absent");
  });

  it("rejects a shift letter that is not A, B or C", () => {
    expect(parseMark(["D"], null, 3)).toContain("A, B or C");
  });

  it("keeps A, B, C order whatever order they arrive in", () => {
    expect(parseMark(["C", "A"], null, 3)).toEqual({ shifts: ["A", "C"], status: null });
  });
});
