import { describe, it, expect, vi, afterEach } from "vitest";
import { retentionCutoff, RETENTION_OPTIONS } from "@/app/admin/activity-log/activityLog.constants";

describe("retentionCutoff", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("subtracts the given number of months from now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00Z"));
    const cutoff = retentionCutoff(2);
    expect(cutoff.getUTCFullYear()).toBe(2026);
    expect(cutoff.getUTCMonth()).toBe(5); // June, 0-indexed
    expect(cutoff.getUTCDate()).toBe(16);
  });

  it("rolls back across a year boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T00:00:00Z"));
    const cutoff = retentionCutoff(2);
    expect(cutoff.getUTCFullYear()).toBe(2025);
    expect(cutoff.getUTCMonth()).toBe(10); // November
  });

  it("produces an increasingly older date as the window widens", () => {
    const two = retentionCutoff(2).getTime();
    const six = retentionCutoff(6).getTime();
    const oneYear = retentionCutoff(12).getTime();
    expect(six).toBeLessThan(two);
    expect(oneYear).toBeLessThan(six);
  });
});

describe("RETENTION_OPTIONS", () => {
  it("includes the 2-month floor option matching the server's MIN_RETENTION_DAYS", () => {
    expect(RETENTION_OPTIONS.some((o) => o.months === 2)).toBe(true);
  });

  it("is sorted ascending by months, shortest window first", () => {
    const months = RETENTION_OPTIONS.map((o) => o.months);
    const sorted = [...months].sort((a, b) => a - b);
    expect(months).toEqual(sorted);
  });
});
