import { describe, it, expect } from "vitest";
import { normalizeName } from "@/lib/normalizeName";

describe("normalizeName", () => {
  it("lowercases the value", () => {
    expect(normalizeName("SS LOGISTICS")).toBe("sslogistics");
  });

  it("strips all internal whitespace", () => {
    expect(normalizeName("SS LOGISTICS - SUKANYA")).toBe("sslogistics-sukanya");
    expect(normalizeName("SS LOGISTICS -SUKANYA")).toBe("sslogistics-sukanya");
  });

  it("treats tabs and multiple spaces the same as a single space", () => {
    expect(normalizeName("SS\tLOGISTICS   DEEKSHITH")).toBe("sslogisticsdeekshith");
  });

  it("matches two differently-spaced variants of the same name", () => {
    expect(normalizeName("SSLOGISTICS-DEEKSHITH")).toBe(
      normalizeName("SS LOGISTICS-DEEKSHITH"),
    );
  });

  it("does not collapse internal punctuation", () => {
    expect(normalizeName("A-B")).not.toBe(normalizeName("AB"));
  });

  it("returns an empty string unchanged", () => {
    expect(normalizeName("")).toBe("");
  });
});
