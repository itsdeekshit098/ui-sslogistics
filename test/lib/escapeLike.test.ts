import { describe, it, expect } from "vitest";
import { escapeLike } from "@/lib/escapeLike";

describe("escapeLike", () => {
  it("escapes a percent sign", () => {
    expect(escapeLike("50%")).toBe("50\\%");
  });

  it("escapes an underscore", () => {
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes a literal backslash", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("escapes multiple wildcards in one string", () => {
    expect(escapeLike("50%_off")).toBe("50\\%\\_off");
  });

  it("leaves a plain string untouched", () => {
    expect(escapeLike("Chennai")).toBe("Chennai");
  });

  it("returns an empty string unchanged", () => {
    expect(escapeLike("")).toBe("");
  });
});
