import { describe, it, expect, vi, afterEach } from "vitest";
import { getStatusDates, computeExpiryStatus } from "@/utils/expiryStatus";

describe("getStatusDates", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today and today+30 days as YYYY-MM-DD strings", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    const { today, cutoff } = getStatusDates();

    expect(today).toBe("2026-06-15");
    expect(cutoff).toBe("2026-07-15");
  });

  it("rolls the cutoff over a month boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-25T00:00:00Z"));

    const { cutoff } = getStatusDates();

    expect(cutoff).toBe("2026-07-25");
  });
});

describe("computeExpiryStatus", () => {
  const today = "2026-06-15";
  const cutoff = "2026-07-15";

  it("returns null when there's no expiry date", () => {
    expect(computeExpiryStatus(null, today, cutoff)).toBeNull();
    expect(computeExpiryStatus(undefined, today, cutoff)).toBeNull();
    expect(computeExpiryStatus("", today, cutoff)).toBeNull();
  });

  it("returns 'expired' for a date before today", () => {
    expect(computeExpiryStatus("2026-06-14", today, cutoff)).toBe("expired");
  });

  it("returns 'expiring_soon' for today itself", () => {
    expect(computeExpiryStatus("2026-06-15", today, cutoff)).toBe("expiring_soon");
  });

  it("returns 'expiring_soon' for a date within the cutoff window", () => {
    expect(computeExpiryStatus("2026-07-01", today, cutoff)).toBe("expiring_soon");
  });

  it("returns 'expiring_soon' for the cutoff date itself", () => {
    expect(computeExpiryStatus("2026-07-15", today, cutoff)).toBe("expiring_soon");
  });

  it("returns 'active' for a date beyond the cutoff", () => {
    expect(computeExpiryStatus("2026-07-16", today, cutoff)).toBe("active");
  });
});
