// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Badge } from "@ui/components/badge";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders a leading dot only when dot is true", () => {
    const { container, rerender } = render(<Badge>Status</Badge>);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();

    rerender(<Badge dot>Status</Badge>);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("Badge styles", () => {
  it("lives in the ui cascade layer", () => {
    render(<Badge>x</Badge>);
    expect(isInUiLayer(screen.getByText("x"))).toBe(true);
  });

  it("is a small inline pill-shaped label", () => {
    render(<Badge>x</Badge>);
    const css = styleOf(screen.getByText("x"));
    expect(css.display).toBe("inline-flex");
    expect(css["font-size"]).toBe("0.75rem");
    expect(css["font-weight"]).toBe("600");
    expect(css["border-radius"]).toBe("var(--badge-radius)");
  });

  it("keeps a ratio line height, so the phone's smaller font does not leave a taller line", () => {
    // Regression: a fixed 1rem line height made phone badges 1.3px taller than before.
    render(<Badge>x</Badge>);
    const lineHeight = styleOf(screen.getByText("x"))["line-height"];
    expect(lineHeight).toBe("var(--tw-leading, calc(1 / 0.75))");
    expect(styleOf(screen.getByText("x"), { media: "(max-width: 767.98px)" })["line-height"]).toBeUndefined();
  });

  it("is fully rounded with tighter padding on phones", () => {
    render(<Badge>x</Badge>);
    const phone = styleOf(screen.getByText("x"), { media: "(max-width: 767.98px)" });
    expect(phone["border-radius"]).toBe("9999px");
    expect(phone["font-size"]).toBe("11px");
  });

  it.each([
    ["default", "var(--primary)"],
    ["secondary", "var(--secondary)"],
    ["destructive", "var(--destructive)"],
    ["success", "var(--success)"],
    ["warning", "var(--warning)"],
    ["info", "var(--info)"],
    ["success-subtle", "var(--success-subtle)"],
    ["warning-subtle", "var(--warning-subtle)"],
    ["destructive-subtle", "var(--destructive-subtle)"],
    ["info-subtle", "var(--info-subtle)"],
  ] as const)("variant %s uses its background token", (variant, background) => {
    render(<Badge variant={variant}>x</Badge>);
    expect(styleOf(screen.getByText("x"))["background-color"]).toBe(background);
  });

  it("outline has no fill, just the foreground colour", () => {
    render(<Badge variant="outline">x</Badge>);
    const css = styleOf(screen.getByText("x"));
    expect(css.color).toBe("var(--foreground)");
    expect(css["background-color"]).toBeUndefined();
  });

  it("tints a subtle badge's border from its tone", () => {
    render(<Badge variant="success-subtle">x</Badge>);
    expect(styleOf(screen.getByText("x"))["border-color"]).toContain("color-mix");
  });

  it("keeps a caller's className", () => {
    render(<Badge className="self-start">x</Badge>);
    expect(screen.getByText("x")).toHaveClass("self-start");
  });
});
