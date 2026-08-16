import { describe, it, expect } from "vitest";
import {
  effectiveEntries,
  computeFunding,
  type FundingEntry,
  type FundingRate,
} from "@/app/api/fundings/fundings.utils";

function entry(overrides: Partial<FundingEntry>): FundingEntry {
  return {
    id: 1,
    entry_type: "PRINCIPAL_TAKEN",
    amount: 0,
    entry_date: "2026-01-01",
    reverses_entry_id: null,
    ...overrides,
  };
}

function rate(overrides: Partial<FundingRate>): FundingRate {
  return {
    roi: 2,
    roi_basis: "MONTHLY",
    fixed_interest_amount: null,
    effective_from: "2026-01-01",
    ...overrides,
  };
}

describe("effectiveEntries", () => {
  it("passes through entries with no reversal involvement", () => {
    const entries = [entry({ id: 1 }), entry({ id: 2 })];
    expect(effectiveEntries(entries)).toEqual(entries);
  });

  it("drops both a reversed entry and its reversal, leaving them netted to zero", () => {
    const original = entry({ id: 1, amount: 5000 });
    const reversal = entry({ id: 2, amount: 5000, reverses_entry_id: 1 });
    const untouched = entry({ id: 3, amount: 1000 });
    expect(effectiveEntries([original, reversal, untouched])).toEqual([
      untouched,
    ]);
  });

  it("leaves unrelated entries alone when only one pair is reversed", () => {
    const a = entry({ id: 1 });
    const b = entry({ id: 2 });
    const bReversal = entry({ id: 3, reverses_entry_id: 2 });
    expect(effectiveEntries([a, b, bReversal]).map((e) => e.id)).toEqual([1]);
  });
});

describe("computeFunding — PERCENT mode, simple interest", () => {
  it("returns all zeros when there is no principal entry", () => {
    const result = computeFunding({
      entries: [],
      rates: [rate({})],
      interestMode: "PERCENT",
      asOf: "2026-03-01",
    });
    expect(result.principal_outstanding).toBe(0);
    expect(result.interest_accrued).toBe(0);
    expect(result.monthly_breakdown).toEqual([]);
  });

  it("accrues a full month's simple interest for a full 30-day month", () => {
    // ₹1,00,000 at 2%/month for the whole of a 30-day window ⇒ ₹2,000.
    const result = computeFunding({
      entries: [
        entry({ id: 1, entry_type: "PRINCIPAL_TAKEN", amount: 100000, entry_date: "2026-01-01" }),
      ],
      rates: [rate({ roi: 2, roi_basis: "MONTHLY", effective_from: "2026-01-01" })],
      interestMode: "PERCENT",
      asOf: "2026-01-31",
    });
    expect(result.interest_accrued).toBe(2000);
    expect(result.principal_outstanding).toBe(100000);
  });

  it("pro-rates interest for a half month, taken on the 10th and checked on the 25th", () => {
    // 15 days of a 30-day month at 2%/month on ₹1,00,000 ⇒ ₹1,000.
    const result = computeFunding({
      entries: [
        entry({ id: 1, entry_type: "PRINCIPAL_TAKEN", amount: 100000, entry_date: "2026-01-10" }),
      ],
      rates: [rate({ roi: 2, roi_basis: "MONTHLY", effective_from: "2026-01-01" })],
      interestMode: "PERCENT",
      asOf: "2026-01-25",
    });
    expect(result.interest_accrued).toBe(1000);
  });

  it("keeps interest simple: unpaid interest never joins the principal for the next month", () => {
    // Two full 30-day months at 2%/month on ₹1,00,000, no interest paid.
    // Simple interest: 2,000 + 2,000 = 4,000. Compounding would give more.
    const result = computeFunding({
      entries: [
        entry({ id: 1, entry_type: "PRINCIPAL_TAKEN", amount: 100000, entry_date: "2026-01-01" }),
      ],
      rates: [rate({ roi: 2, roi_basis: "MONTHLY", effective_from: "2026-01-01" })],
      interestMode: "PERCENT",
      asOf: "2026-03-02",
    });
    expect(result.interest_accrued).toBe(4000);
  });

  it("stops accruing on repaid principal from the day it is repaid", () => {
    const result = computeFunding({
      entries: [
        entry({ id: 1, entry_type: "PRINCIPAL_TAKEN", amount: 100000, entry_date: "2026-01-01" }),
        entry({ id: 2, entry_type: "PRINCIPAL_REPAID", amount: 100000, entry_date: "2026-01-16" }),
      ],
      rates: [rate({ roi: 2, roi_basis: "MONTHLY", effective_from: "2026-01-01" })],
      interestMode: "PERCENT",
      asOf: "2026-02-01",
    });
    // 15 days of ₹1,00,000 at 2%/month ⇒ ₹1,000, then zero principal after.
    expect(result.interest_accrued).toBe(1000);
    expect(result.principal_outstanding).toBe(0);
  });

  it("converts an ANNUAL rate to its monthly equivalent (roi / 12)", () => {
    // 24% annual == 2% monthly, so this must match the monthly-quoted case above.
    const result = computeFunding({
      entries: [
        entry({ id: 1, entry_type: "PRINCIPAL_TAKEN", amount: 100000, entry_date: "2026-01-01" }),
      ],
      rates: [rate({ roi: 24, roi_basis: "ANNUAL", effective_from: "2026-01-01" })],
      interestMode: "PERCENT",
      asOf: "2026-01-31",
    });
    expect(result.interest_accrued).toBe(2000);
  });

  it("applies a rate change only from its effective date onward", () => {
    // Interest is a per-day rate normalized to a 30-day month, so a real
    // 31-day January at 2%/month on 100,000 is 31 * (100000*0.02/100)/30 =
    // 2,066.67 — not a flat 2,000. Feb (28 real days, checked as-of Mar 1 so
    // the full month is counted) picks up the new 3% rate from Feb 1:
    // 28 * (100000*0.03/100)/30 = 2,800.
    const result = computeFunding({
      entries: [
        entry({ id: 1, entry_type: "PRINCIPAL_TAKEN", amount: 100000, entry_date: "2026-01-01" }),
      ],
      rates: [
        rate({ roi: 2, roi_basis: "MONTHLY", effective_from: "2026-01-01" }),
        rate({ roi: 3, roi_basis: "MONTHLY", effective_from: "2026-02-01" }),
      ],
      interestMode: "PERCENT",
      asOf: "2026-03-01",
    });
    const jan = result.monthly_breakdown.find((m) => m.month === "2026-01-01");
    const feb = result.monthly_breakdown.find((m) => m.month === "2026-02-01");
    expect(jan?.interest_accrued).toBeCloseTo(2066.67, 1);
    expect(feb?.interest_accrued).toBeCloseTo(2800, 1);
  });

  it("nets interest_due against interest already paid, and can go negative", () => {
    const result = computeFunding({
      entries: [
        entry({ id: 1, entry_type: "PRINCIPAL_TAKEN", amount: 100000, entry_date: "2026-01-01" }),
        entry({ id: 2, entry_type: "INTEREST_PAID", amount: 5000, entry_date: "2026-01-20" }),
      ],
      rates: [rate({ roi: 2, roi_basis: "MONTHLY", effective_from: "2026-01-01" })],
      interestMode: "PERCENT",
      asOf: "2026-01-31",
    });
    // 2,000 accrued, 5,000 paid ⇒ paid ahead by 3,000.
    expect(result.interest_accrued).toBe(2000);
    expect(result.interest_paid).toBe(5000);
    expect(result.interest_due).toBe(-3000);
  });

  it("excludes a reversed principal entry from the accrual entirely", () => {
    const withReversal = computeFunding({
      entries: [
        entry({ id: 1, entry_type: "PRINCIPAL_TAKEN", amount: 100000, entry_date: "2026-01-01" }),
        entry({ id: 2, entry_type: "PRINCIPAL_TAKEN", amount: 50000, entry_date: "2026-01-05" }),
        entry({ id: 3, entry_type: "PRINCIPAL_TAKEN", amount: 50000, entry_date: "2026-01-05", reverses_entry_id: 2 }),
      ],
      rates: [rate({ roi: 2, roi_basis: "MONTHLY", effective_from: "2026-01-01" })],
      interestMode: "PERCENT",
      asOf: "2026-01-31",
    });
    const withoutReversal = computeFunding({
      entries: [
        entry({ id: 1, entry_type: "PRINCIPAL_TAKEN", amount: 100000, entry_date: "2026-01-01" }),
      ],
      rates: [rate({ roi: 2, roi_basis: "MONTHLY", effective_from: "2026-01-01" })],
      interestMode: "PERCENT",
      asOf: "2026-01-31",
    });
    expect(withReversal.principal_outstanding).toBe(withoutReversal.principal_outstanding);
    expect(withReversal.interest_accrued).toBe(withoutReversal.interest_accrued);
  });
});

describe("computeFunding — FIXED mode", () => {
  it("spreads a flat monthly amount pro rata across a part month", () => {
    // ₹3,000/month flat, 15 of 30 days ⇒ ₹1,500.
    const result = computeFunding({
      entries: [
        entry({ id: 1, entry_type: "PRINCIPAL_TAKEN", amount: 100000, entry_date: "2026-01-01" }),
      ],
      rates: [rate({ roi: null, roi_basis: null, fixed_interest_amount: 3000, effective_from: "2026-01-01" })],
      interestMode: "FIXED",
      asOf: "2026-01-16",
    });
    expect(result.interest_accrued).toBe(1500);
  });

  it("charges nothing once principal outstanding hits zero, even under a fixed arrangement", () => {
    const result = computeFunding({
      entries: [
        entry({ id: 1, entry_type: "PRINCIPAL_TAKEN", amount: 100000, entry_date: "2026-01-01" }),
        entry({ id: 2, entry_type: "PRINCIPAL_REPAID", amount: 100000, entry_date: "2026-01-06" }),
      ],
      rates: [rate({ roi: null, roi_basis: null, fixed_interest_amount: 3000, effective_from: "2026-01-01" })],
      interestMode: "FIXED",
      asOf: "2026-01-16",
    });
    // 5 days of 3000/month flat: 5 * 100 = 500, then nothing after payoff.
    expect(result.interest_accrued).toBe(500);
  });

  it("reports monthly_rate as null in FIXED mode", () => {
    const result = computeFunding({
      entries: [
        entry({ id: 1, entry_type: "PRINCIPAL_TAKEN", amount: 100000, entry_date: "2026-01-01" }),
      ],
      rates: [rate({ roi: null, roi_basis: null, fixed_interest_amount: 3000, effective_from: "2026-01-01" })],
      interestMode: "FIXED",
      asOf: "2026-01-16",
    });
    expect(result.monthly_breakdown[0].monthly_rate).toBeNull();
  });
});
