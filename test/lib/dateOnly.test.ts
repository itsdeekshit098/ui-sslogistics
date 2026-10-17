import { describe, it, expect, vi, afterEach } from "vitest";
import {
  toDateString,
  parseDate,
  addDays,
  todayInIndia,
  addMonths,
} from "@/lib/dateOnly";

describe("toDateString / parseDate", () => {
  it("round-trips a date string through UTC midnight", () => {
    expect(toDateString(parseDate("2026-03-15"))).toBe("2026-03-15");
  });

  it("parses the first and last day of a month correctly", () => {
    expect(toDateString(parseDate("2026-02-01"))).toBe("2026-02-01");
    expect(toDateString(parseDate("2026-02-28"))).toBe("2026-02-28");
  });

  it("does not drift across a local-timezone boundary", () => {
    const d = parseDate("2026-01-01");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(1);
  });
});

describe("addDays", () => {
  it("adds days within the same month", () => {
    expect(addDays("2026-03-10", 5)).toBe("2026-03-15");
  });

  it("subtracts days with a negative count", () => {
    expect(addDays("2026-03-10", -5)).toBe("2026-03-05");
  });

  it("rolls over a month boundary", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("rolls over a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles a leap-year February correctly", () => {
    // 2028 is a leap year.
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("handles a non-leap-year February correctly", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("adding zero days returns the same date", () => {
    expect(addDays("2026-06-15", 0)).toBe("2026-06-15");
  });
});

describe("addMonths", () => {
  it("adds months within the same year", () => {
    expect(addMonths("2026-03", 2)).toBe("2026-05");
  });

  it("rolls over a year boundary going forward", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
  });

  it("rolls over a year boundary going backward", () => {
    expect(addMonths("2026-01", -2)).toBe("2025-11");
  });

  it("adding zero months returns the same month", () => {
    expect(addMonths("2026-06", 0)).toBe("2026-06");
  });

  it("handles a multi-year jump", () => {
    expect(addMonths("2026-01", 24)).toBe("2028-01");
  });
});

describe("todayInIndia", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an IST calendar date even when UTC is still on the previous day", () => {
    // 2026-06-15T19:00:00Z is 2026-06-16T00:30 IST — past midnight IST.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T19:00:00Z"));
    expect(todayInIndia()).toBe("2026-06-16");
  });

  it("returns the same calendar date as UTC when well within the day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
    expect(todayInIndia()).toBe("2026-06-15");
  });

  it("returns a YYYY-MM-DD shaped string", () => {
    expect(todayInIndia()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
