import { describe, it, expect } from "vitest";
import { computeWarrantyExpiry, computeExpiryDateFromStrings } from "@/utils/warrantyExpiry";

describe("computeWarrantyExpiry", () => {
  it("adds whole months within the same year", () => {
    expect(computeWarrantyExpiry("2026-03-15", 2, "months")).toBe("2026-05-15");
  });

  it("adds whole years", () => {
    expect(computeWarrantyExpiry("2026-03-15", 2, "years")).toBe("2028-03-15");
  });

  it("clamps Jan 31 + 1 month to Feb 28 in a non-leap year", () => {
    expect(computeWarrantyExpiry("2026-01-31", 1, "months")).toBe("2026-02-28");
  });

  it("clamps Jan 31 + 1 month to Feb 29 in a leap year", () => {
    expect(computeWarrantyExpiry("2028-01-31", 1, "months")).toBe("2028-02-29");
  });

  it("rolls a month addition over a year boundary", () => {
    expect(computeWarrantyExpiry("2026-11-15", 3, "months")).toBe("2027-02-15");
  });

  it("returns an empty string for a zero duration", () => {
    expect(computeWarrantyExpiry("2026-01-01", 0, "months")).toBe("");
  });

  it("returns an empty string for a negative duration", () => {
    expect(computeWarrantyExpiry("2026-01-01", -1, "months")).toBe("");
  });

  it("returns an empty string for an empty purchase date", () => {
    expect(computeWarrantyExpiry("", 1, "months")).toBe("");
  });

  it("returns an empty string for an invalid purchase date", () => {
    expect(computeWarrantyExpiry("not-a-date", 1, "months")).toBe("");
  });

  it("does not clamp when the target month has enough days", () => {
    expect(computeWarrantyExpiry("2026-01-15", 1, "months")).toBe("2026-02-15");
  });
});

describe("computeExpiryDateFromStrings", () => {
  it("parses a numeric string duration", () => {
    expect(computeExpiryDateFromStrings("2026-01-01", "6", "months")).toBe("2026-07-01");
  });

  it("returns an empty string for a non-numeric duration", () => {
    expect(computeExpiryDateFromStrings("2026-01-01", "abc", "months")).toBe("");
  });

  it("returns an empty string for a zero or negative duration string", () => {
    expect(computeExpiryDateFromStrings("2026-01-01", "0", "months")).toBe("");
    expect(computeExpiryDateFromStrings("2026-01-01", "-5", "months")).toBe("");
  });
});
