import { describe, it, expect } from "vitest";
import { toCssLength } from "@ui/utils/cssLength";

describe("toCssLength", () => {
  it("treats a number as pixels and passes a string through", () => {
    expect(toCssLength(120)).toBe("120px");
    expect(toCssLength("12rem")).toBe("12rem");
    expect(toCssLength("30%")).toBe("30%");
  });
  it("leaves undefined alone", () => {
    expect(toCssLength(undefined)).toBeUndefined();
  });
});
