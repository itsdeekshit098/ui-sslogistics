// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Skeleton } from "@ui/components/skeleton";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

const skeleton = (container: HTMLElement) => container.firstChild as HTMLElement;

describe("Skeleton", () => {
  it("defaults to full-width 16px height with 6px radius", () => {
    const { container } = render(<Skeleton />);
    const css = styleOf(skeleton(container));
    expect(css.width).toBe("100%");
    expect(css.height).toBe("16px");
    expect(css["border-radius"]).toBe("6px");
  });

  it("normalizes a numeric width/height/radius to px", () => {
    const { container } = render(<Skeleton width={120} height={40} borderRadius={8} />);
    const css = styleOf(skeleton(container));
    expect(css.width).toBe("120px");
    expect(css.height).toBe("40px");
    expect(css["border-radius"]).toBe("8px");
  });

  it("passes through a string width/height unchanged", () => {
    const { container } = render(<Skeleton width="50%" height="2rem" />);
    const css = styleOf(skeleton(container));
    expect(css.width).toBe("50%");
    expect(css.height).toBe("2rem");
  });

  it("uses the theme's skeleton fill and pulses, with no inline style", () => {
    const { container } = render(<Skeleton />);
    const el = skeleton(container);
    expect(isInUiLayer(el)).toBe(true);
    expect(styleOf(el)["background-color"]).toBe("var(--skeleton)");
    expect(styleOf(el).animation).toContain("2s");
    expect(el.getAttribute("style")).toBeNull();
  });

  it("is inline-block by default, block when asked, and centres itself with margin auto", () => {
    const a = render(<Skeleton />);
    expect(styleOf(skeleton(a.container)).display).toBe("inline-block");
    a.unmount();
    const b = render(<Skeleton block />);
    expect(styleOf(skeleton(b.container)).display).toBe("block");
    b.unmount();
    const c = render(<Skeleton center />);
    const css = styleOf(skeleton(c.container));
    expect(css.display).toBe("block");
    expect(css["margin-inline"]).toBe("auto");
  });

  it("offers a quieter muted fill for placeholders drawn inside a table", () => {
    const { container } = render(<Skeleton tone="muted" />);
    expect(styleOf(skeleton(container))["background-color"]).toBe("var(--muted)");
  });
});
