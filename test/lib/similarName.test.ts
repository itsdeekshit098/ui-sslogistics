import { describe, expect, it } from "vitest";
import { findSimilarNames, isSimilarName } from "@/lib/similarName";

describe("isSimilarName — spellings of one name", () => {
  it("matches transliterations of the same name", () => {
    expect(isSimilarName("MAHABOOB", "MEHABOOB")).toBe(true);
    expect(isSimilarName("Mehboob", "Mehaboob")).toBe(true);
    expect(isSimilarName("Mahboob", "MEHABOOB")).toBe(true);
  });

  it("matches the same name typed differently", () => {
    expect(isSimilarName("mehaboob", "MEHABOOB")).toBe(true);
    expect(isSimilarName("  Mehaboob  ", "Mehaboob")).toBe(true);
    expect(isSimilarName("Mehaboob", "Meha boob")).toBe(true);
  });

  it("matches a name that is a full part of another", () => {
    expect(isSimilarName("Ramesh", "Ramesh Kumar")).toBe(true);
    expect(isSimilarName("Suresh Babu", "Suresh")).toBe(true);
  });

  it("matches other common transliteration pairs", () => {
    expect(isSimilarName("Yousuf", "Yusuf")).toBe(true);
    expect(isSimilarName("Shaik", "Sheik")).toBe(true);
    expect(isSimilarName("Mohammed", "Muhammad")).toBe(true);
  });

  it("leaves very short names alone, even when they sound alike", () => {
    // "Khan"/"Kan" are the same name, but matching 3-4 letter names by sound
    // also matches every unrelated short pair ("Ravi"/"Ravu"). A missed
    // warning on a short name costs less than flagging half the roster, and
    // the exact-duplicate check still catches "Khan" vs "KHAN".
    expect(isSimilarName("Khan", "Kan")).toBe(false);
  });

  it("matches a single-letter slip in a longer name", () => {
    expect(isSimilarName("Narayana", "Narayanna")).toBe(true);
    expect(isSimilarName("Venkatesh", "Venkatesr")).toBe(true);
  });
});

describe("isSimilarName — genuinely different people", () => {
  it("does not match unrelated names", () => {
    expect(isSimilarName("Ramesh", "Suresh")).toBe(false);
    expect(isSimilarName("Mehaboob", "Narayana")).toBe(false);
    expect(isSimilarName("Kiran", "Balaji")).toBe(false);
  });

  it("does not match short names that differ by a letter", () => {
    // Four letters apart by one is far more likely to be two people than a
    // typo, so short names get no slack at all.
    expect(isSimilarName("Ravi", "Ravu")).toBe(false);
    expect(isSimilarName("Raju", "Ravi")).toBe(false);
  });

  it("does not match on a short fragment of a longer name", () => {
    // "Ram" appearing inside "Ramesh" must not drag in every Ram*.
    expect(isSimilarName("Ram", "Ramesh Kumar")).toBe(false);
  });

  it("handles empty and junk input without matching", () => {
    expect(isSimilarName("", "Ramesh")).toBe(false);
    expect(isSimilarName("Ramesh", "")).toBe(false);
    expect(isSimilarName("   ", "Ramesh")).toBe(false);
  });
});

describe("findSimilarNames", () => {
  const rows = [
    { id: 1, name: "MEHABOOB" },
    { id: 2, name: "Ramesh Kumar" },
    { id: 3, name: "Suresh Babu" },
    { id: 4, name: "Narayana" },
  ];

  it("returns every row worth a second look", () => {
    expect(findSimilarNames("MAHABOOB", rows).map((r) => r.id)).toEqual([1]);
    expect(findSimilarNames("Ramesh", rows).map((r) => r.id)).toEqual([2]);
  });

  it("returns nothing for a genuinely new name", () => {
    expect(findSimilarNames("Prasad Reddy", rows)).toEqual([]);
  });

  it("skips the row being edited, so renaming a driver never flags itself", () => {
    expect(findSimilarNames("MEHABOOB", rows, 1)).toEqual([]);
    // ...but still flags a different row with that name.
    expect(findSimilarNames("MEHABOOB", rows, 2).map((r) => r.id)).toEqual([1]);
  });
});
