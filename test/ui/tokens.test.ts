import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tokenNames } from "@ui/tokens/tokens";
import { media } from "@ui/tokens/media";

const css = readFileSync(
  path.resolve(import.meta.dirname, "../../src/ui/tokens/tokens.css"),
  "utf8",
);

describe("tokens.ts", () => {
  it("only references custom properties that tokens.css defines", () => {
    const missing = tokenNames.filter(
      (name) => !new RegExp(`^\\s*--${name}:`, "m").test(css),
    );
    expect(missing).toEqual([]);
  });

  it("keeps the dark and system-preference blocks after the move", () => {
    // Guards the move out of globals.css: the dark block must still exist.
    expect(css).toMatch(/^\.dark \{/m);
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)/);
  });
});

describe("media", () => {
  it("draws the phone line exactly where Tailwind's max-md does", () => {
    expect(media.phone).toBe("@media (max-width: 767.98px)");
  });
});
