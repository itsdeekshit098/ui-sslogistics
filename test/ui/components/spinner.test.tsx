// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Spinner } from "@ui/components/spinner";
import { styleOf, hasLockedRule } from "@test/uiStyles";

afterEach(cleanup);

describe("Spinner", () => {
  it("renders an inline SVG arc by default (no label, not centered)", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders bouncing dots when centered", () => {
    const { container } = render(<Spinner centered />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelectorAll("span").length).toBeGreaterThanOrEqual(3);
  });

  it("renders bouncing dots when a label is given, even without centered", () => {
    render(<Spinner label="Loading…" />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("does not render a label span when no label is given in dots mode", () => {
    const { container } = render(<Spinner centered />);
    // 3 dot spans only, no label span
    expect(container.querySelectorAll("span").length).toBe(3);
  });
});

describe("Spinner styles", () => {
  it("keeps its size preset even when a caller passes sizing classes", () => {
    // Regression guard: the size used to be inline style, which a caller's
    // `h-4 w-4` could never override. The rule is `locked` to keep that true.
    const { container } = render(<Spinner size="sm" className="h-8 w-8" />);
    const svg = container.querySelector("svg")!;
    expect(styleOf(svg).width).toBe("16px");
    expect(styleOf(svg).height).toBe("16px");
    expect(svg).toHaveClass("h-8", "w-8");
    expect(svg.getAttribute("style")).toBeNull();
    expect(hasLockedRule(svg)).toBe(true);
  });

  it.each([
    ["xs", 12],
    ["sm", 16],
    ["md", 24],
    ["lg", 32],
    ["xl", 48],
  ] as const)("the %s arc is %ipx", (size, px) => {
    const { container } = render(<Spinner size={size} />);
    expect(styleOf(container.querySelector("svg")!).width).toBe(`${px}px`);
  });

  it("spins the arc and bounces the dots in turn", () => {
    const { container, rerender } = render(<Spinner />);
    expect(styleOf(container.querySelector("svg")!).animation).toContain("1s linear infinite");
    rerender(<Spinner centered />);
    const dots = Array.from(container.querySelectorAll("span"));
    expect(styleOf(dots[0]).animation).toContain("1.4s ease-in-out infinite");
    expect(styleOf(dots[1], { state: ":nth-child(2)" })["animation-delay"]).toBe("0.16s");
    expect(styleOf(dots[2], { state: ":nth-child(3)" })["animation-delay"]).toBe("0.32s");
  });
});
