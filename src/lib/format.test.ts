import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatDate,
  formatMonth,
  todayString,
} from "./format";

describe("formatCurrency", () => {
  it("formats with Indian digit grouping and no paise", () => {
    expect(formatCurrency(100000)).toBe("₹1,00,000");
  });

  it("returns an em dash for null/undefined/NaN", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
    expect(formatCurrency(NaN)).toBe("—");
  });
});

describe("formatCurrencyPrecise", () => {
  it("keeps exactly two decimal places", () => {
    expect(formatCurrencyPrecise(1234.5)).toBe("₹1,234.50");
  });

  it("returns an em dash for null", () => {
    expect(formatCurrencyPrecise(null)).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats a date-only string as UTC, not local time", () => {
    expect(formatDate("2026-08-12")).toBe("12 Aug 2026");
  });

  it("ignores a trailing time component", () => {
    expect(formatDate("2026-08-12T18:30:00Z")).toBe("12 Aug 2026");
  });

  it("returns an em dash for a falsy value", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("formatMonth", () => {
  it("formats YYYY-MM as a full month name and year", () => {
    expect(formatMonth("2026-08-01")).toBe("August 2026");
  });
});

describe("todayString", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current UTC date as YYYY-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T23:59:00Z"));
    expect(todayString()).toBe("2026-08-16");
  });
});
