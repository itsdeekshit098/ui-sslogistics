import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatDate,
  formatDateCompact,
  formatMonth,
  todayString,
} from "@/lib/format";

describe("formatCurrency", () => {
  it("formats with Indian grouping and no decimals", () => {
    expect(formatCurrency(1234567)).toBe("₹12,34,567");
  });

  it("rounds off fractional paise", () => {
    expect(formatCurrency(100.6)).toBe("₹101");
  });

  it("returns an em dash for null/undefined/NaN", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
    expect(formatCurrency(NaN)).toBe("—");
  });

  it("formats zero and negative values", () => {
    expect(formatCurrency(0)).toBe("₹0");
    expect(formatCurrency(-500)).toBe("₹-500");
  });
});

describe("formatCurrencyPrecise", () => {
  it("always shows exactly two decimal places", () => {
    expect(formatCurrencyPrecise(1234.5)).toBe("₹1,234.50");
    expect(formatCurrencyPrecise(1234)).toBe("₹1,234.00");
  });

  it("returns an em dash for null/undefined/NaN", () => {
    expect(formatCurrencyPrecise(null)).toBe("—");
    expect(formatCurrencyPrecise(undefined)).toBe("—");
    expect(formatCurrencyPrecise(NaN)).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats a date-only string as 'D Mon YYYY' in UTC", () => {
    expect(formatDate("2026-08-12")).toBe("12 Aug 2026");
  });

  it("is unaffected by a time component / parses only the date part", () => {
    expect(formatDate("2026-08-12T23:59:59Z")).toBe("12 Aug 2026");
  });

  it("returns an em dash for null/undefined/empty", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("does not shift a day near a timezone boundary (the bug UTC parsing prevents)", () => {
    // If parsed as local time in a UTC+ timezone, "2026-01-01" could render
    // as 31 Dec 2025 depending on the runner's TZ. UTC-anchored parsing
    // keeps it pinned to the literal calendar date.
    expect(formatDate("2026-01-01")).toBe("1 Jan 2026");
  });
});

describe("formatDateCompact", () => {
  it("formats with a 2-digit year", () => {
    expect(formatDateCompact("2026-08-12")).toBe("12 Aug 26");
  });

  it("returns an em dash for a falsy value", () => {
    expect(formatDateCompact(null)).toBe("—");
  });
});

describe("formatMonth", () => {
  it("formats a YYYY-MM value as 'Month YYYY'", () => {
    expect(formatMonth("2026-08")).toBe("August 2026");
  });

  it("formats a full date string by truncating to its month", () => {
    expect(formatMonth("2026-08-15")).toBe("August 2026");
  });
});

describe("todayString", () => {
  it("returns today's date as YYYY-MM-DD", () => {
    const expected = new Date().toISOString().slice(0, 10);
    expect(todayString()).toBe(expected);
  });

  it("matches the YYYY-MM-DD shape", () => {
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
