import { describe, it, expect } from "vitest";
import { isSimilarName, findSimilarNames } from "@/lib/similarName";

describe("isSimilarName", () => {
  it("is true for the exact same name, ignoring case", () => {
    expect(isSimilarName("Mehaboob", "MEHABOOB")).toBe(true);
  });

  it("is true for the exact same name once spacing is ignored", () => {
    expect(isSimilarName("Ravi Kumar", "RaviKumar")).toBe(true);
  });

  it("is true when one name fully contains the other and both are long enough", () => {
    expect(isSimilarName("Ramesh", "Ramesh Kumar")).toBe(true);
  });

  it("is false for a short name contained in a longer one — below the length floor", () => {
    // "Jo" is only 2 letters; it must not match half the roster.
    expect(isSimilarName("Jo", "John Smith")).toBe(false);
  });

  it("recognizes common transliteration variants of the same name", () => {
    expect(isSimilarName("Mehaboob", "Mahaboob")).toBe(true);
    expect(isSimilarName("Mehaboob", "Mehboob")).toBe(true);
  });

  it("is false for two short, clearly different names a letter apart", () => {
    expect(isSimilarName("Ravi", "Ravu")).toBe(false);
  });

  it("tolerates a single-letter typo in a medium-length name", () => {
    expect(isSimilarName("Srinivas", "Srinivasa")).toBe(true);
  });

  it("is false for two names that share a prefix but are otherwise unrelated", () => {
    expect(isSimilarName("Suresh", "Suman")).toBe(false);
  });

  it("is false for two clearly unrelated names", () => {
    expect(isSimilarName("Ravi Kumar", "John Smith")).toBe(false);
  });

  it("is false when either name is empty after stripping punctuation", () => {
    expect(isSimilarName("", "Ravi")).toBe(false);
    expect(isSimilarName("---", "Ravi")).toBe(false);
  });

  it("is case- and punctuation-insensitive throughout", () => {
    expect(isSimilarName("ravi-kumar", "RAVI KUMAR")).toBe(true);
  });
});

describe("findSimilarNames", () => {
  const rows = [
    { id: 1, name: "Mehaboob" },
    { id: 2, name: "Suresh" },
    { id: 3, name: "Mahaboob" },
  ];

  it("returns every row similar to the candidate name", () => {
    const result = findSimilarNames("Mehaboob", rows);
    expect(result.map((r) => r.id)).toEqual([1, 3]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(findSimilarNames("Zzzxyz", rows)).toEqual([]);
  });

  it("excludes the given excludeId even if it would otherwise match", () => {
    const result = findSimilarNames("Mehaboob", rows, 1);
    expect(result.map((r) => r.id)).toEqual([3]);
  });

  it("returns an empty array for an empty row list", () => {
    expect(findSimilarNames("Mehaboob", [])).toEqual([]);
  });
});
