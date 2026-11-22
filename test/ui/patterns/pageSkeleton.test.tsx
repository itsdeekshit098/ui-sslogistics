// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PageSkeleton } from "@ui/patterns/pageSkeleton";
import { styleOf } from "@test/uiStyles";

afterEach(cleanup);

/** Every element inside the container that has a generated class. */
const blocks = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("div, [data-ui='skeleton']")).filter((el) =>
    el.classList.length > 0,
  );

describe("PageSkeleton", () => {
  it("renders the admin variant: a title block, a four-up stat grid and a table block", () => {
    const { container } = render(<PageSkeleton variant="admin" />);
    const all = blocks(container);
    const grid = all.find((el) => styleOf(el)["grid-template-columns"] === "repeat(2, minmax(0, 1fr))");
    expect(grid).toBeDefined();
    expect(styleOf(grid!, { media: "(min-width: 768px)" })["grid-template-columns"]).toBe(
      "repeat(4, minmax(0, 1fr))",
    );
    expect(grid!.children).toHaveLength(4);
    // Every placeholder block pulses with the theme's skeleton fill.
    const filled = all.filter((el) => styleOf(el)["background-color"] === "var(--skeleton)");
    expect(filled.length).toBe(1 + 4 + 1);
  });

  it("renders the login variant: a centred card with a logo, two fields and a button", () => {
    const { container } = render(<PageSkeleton variant="login" />);
    const all = blocks(container);
    const card = all.find((el) => styleOf(el)["max-width"] === "28rem");
    expect(card).toBeDefined();
    const filled = all.filter((el) => styleOf(el)["background-color"] === "var(--skeleton)");
    // logo + tagline + (label + input) × 2 + button
    expect(filled.length).toBe(7);
  });
});
