import { describe, it, expect } from "vitest";
import { csvValue } from "@/lib/csv";

describe("csvValue", () => {
  it("returns a plain string unchanged", () => {
    expect(csvValue("Chennai")).toBe("Chennai");
  });

  it("returns an empty string for null", () => {
    expect(csvValue(null)).toBe("");
  });

  it("returns an empty string for undefined", () => {
    expect(csvValue(undefined)).toBe("");
  });

  it("quotes a value containing a comma", () => {
    expect(csvValue("Chennai, Tamil Nadu")).toBe('"Chennai, Tamil Nadu"');
  });

  it("quotes and escapes a value containing a double quote", () => {
    expect(csvValue('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    expect(csvValue("line1\nline2")).toBe('"line1\nline2"');
  });

  it("quotes a value containing a carriage return", () => {
    expect(csvValue("line1\rline2")).toBe('"line1\rline2"');
  });

  it("neutralizes formula injection via a leading equals sign", () => {
    expect(csvValue("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
  });

  it("neutralizes formula injection via a leading plus sign", () => {
    expect(csvValue("+1+1")).toBe("'+1+1");
  });

  it("neutralizes formula injection via a leading minus sign", () => {
    expect(csvValue("-1-1")).toBe("'-1-1");
  });

  it("neutralizes formula injection via a leading @ sign", () => {
    expect(csvValue("@cmd")).toBe("'@cmd");
  });

  it("leaves a number untouched even if it looks like it starts with a minus", () => {
    expect(csvValue(-5)).toBe("-5");
  });

  it("leaves a positive number untouched", () => {
    expect(csvValue(42)).toBe("42");
  });

  it("does not prefix a string that merely contains, but doesn't start with, a formula character", () => {
    expect(csvValue("total=5")).toBe("total=5");
  });
});
