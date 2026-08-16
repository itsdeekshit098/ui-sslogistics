import { describe, it, expect, vi, afterEach } from "vitest";
import {
  monthBounds,
  shiftMonth,
  daysFromToday,
  relativeDueLabel,
  installmentStatusVariant,
  progressPercent,
} from "@/components/loansPage/loansPage.utils";

describe("monthBounds", () => {
  it("returns the first and last day of the month", () => {
    expect(monthBounds(new Date(Date.UTC(2026, 1, 15)))).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("handles a leap-year February", () => {
    expect(monthBounds(new Date(Date.UTC(2024, 1, 10)))).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
  });
});

describe("shiftMonth", () => {
  it("moves forward across a year boundary", () => {
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
  });

  it("moves backward across a year boundary", () => {
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("is a no-op with delta 0", () => {
    expect(shiftMonth("2026-06-01", 0)).toBe("2026-06-01");
  });
});

describe("daysFromtoday / relativeDueLabel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 and 'today' for today's date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T09:00:00Z"));
    expect(daysFromToday("2026-08-16")).toBe(0);
    expect(relativeDueLabel("2026-08-16")).toBe("today");
  });

  it("says 'tomorrow' / 'yesterday' at the ±1 day boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T09:00:00Z"));
    expect(relativeDueLabel("2026-08-17")).toBe("tomorrow");
    expect(relativeDueLabel("2026-08-15")).toBe("yesterday");
  });

  it("says 'in N days' / 'N days ago' beyond the ±1 day boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T09:00:00Z"));
    expect(relativeDueLabel("2026-08-20")).toBe("in 4 days");
    expect(relativeDueLabel("2026-08-10")).toBe("6 days ago");
  });

  it("returns an em dash for a missing date", () => {
    expect(relativeDueLabel(null)).toBe("—");
    expect(relativeDueLabel(undefined)).toBe("—");
  });
});

describe("installmentStatusVariant", () => {
  it("maps OVERDUE and BOUNCED to the destructive tone", () => {
    expect(installmentStatusVariant("OVERDUE")).toBe("destructive-subtle");
    expect(installmentStatusVariant("BOUNCED")).toBe("destructive-subtle");
  });

  it("maps PAID to success and WAIVED to outline", () => {
    expect(installmentStatusVariant("PAID")).toBe("success-subtle");
    expect(installmentStatusVariant("WAIVED")).toBe("outline");
  });

  it("maps PARTIAL to warning and PENDING to the info default", () => {
    expect(installmentStatusVariant("PARTIAL")).toBe("warning-subtle");
    expect(installmentStatusVariant("PENDING")).toBe("info-subtle");
  });
});

describe("progressPercent", () => {
  it("computes a rounded percentage", () => {
    expect(progressPercent(1, 3)).toBe(33);
  });

  it("returns 0 rather than dividing by zero when total is 0", () => {
    expect(progressPercent(0, 0)).toBe(0);
  });

  it("caps at 100 even if paid somehow exceeds total", () => {
    expect(progressPercent(5, 3)).toBe(100);
  });
});
