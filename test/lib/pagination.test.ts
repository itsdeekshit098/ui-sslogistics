import { describe, it, expect } from "vitest";
import { parsePageParams } from "@/lib/pagination";

const OPTS = { defaultPageSize: 20, maxPageSize: 100 };

describe("parsePageParams", () => {
  it("defaults to page 1 with the default page size when nothing is supplied", () => {
    const result = parsePageParams(new URLSearchParams(), OPTS);
    expect(result).toEqual({ page: 1, pageSize: 20, from: 0, to: 19 });
  });

  it("computes from/to for a later page", () => {
    const result = parsePageParams(new URLSearchParams("page=3"), OPTS);
    expect(result).toEqual({ page: 3, pageSize: 20, from: 40, to: 59 });
  });

  it("honors an explicit page_size", () => {
    const result = parsePageParams(new URLSearchParams("page_size=50"), OPTS);
    expect(result.pageSize).toBe(50);
    expect(result.to).toBe(49);
  });

  it("clamps page_size to maxPageSize", () => {
    const result = parsePageParams(new URLSearchParams("page_size=500"), OPTS);
    expect(result.pageSize).toBe(100);
  });

  it("clamps page to a minimum of 1 for zero or negative input", () => {
    expect(parsePageParams(new URLSearchParams("page=0"), OPTS).page).toBe(1);
    expect(parsePageParams(new URLSearchParams("page=-5"), OPTS).page).toBe(1);
  });

  it("falls back to the default for page_size=0 — 0 is falsy, so `|| defaultPageSize` wins", () => {
    expect(parsePageParams(new URLSearchParams("page_size=0"), OPTS).pageSize).toBe(20);
  });

  it("clamps a negative page_size up to a minimum of 1", () => {
    expect(parsePageParams(new URLSearchParams("page_size=-10"), OPTS).pageSize).toBe(1);
  });

  it("falls back to the default when page is non-numeric", () => {
    const result = parsePageParams(new URLSearchParams("page=abc"), OPTS);
    expect(result.page).toBe(1);
  });

  it("falls back to the default when page_size is non-numeric", () => {
    const result = parsePageParams(new URLSearchParams("page_size=abc"), OPTS);
    expect(result.pageSize).toBe(20);
  });

  it("respects a different defaultPageSize/maxPageSize pair per call site", () => {
    const result = parsePageParams(new URLSearchParams(), {
      defaultPageSize: 50,
      maxPageSize: 200,
    });
    expect(result.pageSize).toBe(50);
  });
});
