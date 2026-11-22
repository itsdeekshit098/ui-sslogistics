// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Button } from "@ui/components/button";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("Button", () => {
  it("renders a native button by default and fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("asChild renders the child element instead of a <button>, forwarding props", () => {
    const onClick = vi.fn();
    render(
      <Button asChild onClick={onClick}>
        <a href="/somewhere">Go</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Go" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/somewhere");
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards a ref to the underlying button element", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>X</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe("Button styles", () => {
  it("lives in the ui cascade layer, so a caller's Tailwind class can still override it", () => {
    render(<Button>Save</Button>);
    expect(isInUiLayer(screen.getByRole("button"))).toBe(true);
  });

  it("is a 40px filled primary button by default", () => {
    render(<Button>Save</Button>);
    const css = styleOf(screen.getByRole("button"));
    expect(css.display).toBe("inline-flex");
    expect(css.height).toBe("var(--input-height)");
    expect(css["background-color"]).toBe("var(--primary)");
    expect(css.color).toBe("var(--primary-foreground)");
    expect(css["font-size"]).toBe("0.875rem");
    expect(css["font-weight"]).toBe("500");
  });

  it.each([
    ["sm", "var(--input-height-sm)"],
    ["lg", "var(--input-height-lg)"],
    ["icon", "var(--input-height)"],
  ] as const)("size %s sets its height token", (size, height) => {
    render(<Button size={size}>x</Button>);
    expect(styleOf(screen.getByRole("button")).height).toBe(height);
  });

  it("an icon button is square", () => {
    render(<Button size="icon">x</Button>);
    const css = styleOf(screen.getByRole("button"));
    expect(css.width).toBe(css.height);
  });

  it("each variant sets its own colours", () => {
    const { rerender } = render(<Button variant="destructive">x</Button>);
    expect(styleOf(screen.getByRole("button"))["background-color"]).toBe("var(--destructive)");
    rerender(<Button variant="secondary">x</Button>);
    expect(styleOf(screen.getByRole("button"))["background-color"]).toBe("var(--secondary)");
    rerender(<Button variant="outline">x</Button>);
    const outline = styleOf(screen.getByRole("button"));
    expect(outline["border-color"]).toBe("var(--input)");
    expect(outline["background-color"]).toBe("var(--background)");
    rerender(<Button variant="link">x</Button>);
    expect(styleOf(screen.getByRole("button")).color).toBe("var(--primary)");
  });

  it("only changes colour on hover where a pointer can hover", () => {
    render(<Button>x</Button>);
    const hover = styleOf(screen.getByRole("button"), { state: ":hover", media: "(hover: hover)" });
    expect(hover["background-color"]).toContain("color-mix");
    expect(styleOf(screen.getByRole("button"), { state: ":hover" })).toEqual({});
  });

  it("dims and shows a not-allowed cursor when disabled", () => {
    render(<Button disabled>x</Button>);
    const css = styleOf(screen.getByRole("button"), { state: ":disabled" });
    expect(css.opacity).toBe("50%");
    expect(css.cursor).toBe("not-allowed");
  });

  it("draws a focus ring for keyboard focus only", () => {
    render(<Button>x</Button>);
    const css = styleOf(screen.getByRole("button"), { state: ":focus-visible" });
    expect(css["box-shadow"]).toContain("var(--ring)");
  });

  it("asChild gives the child the same styles", () => {
    render(
      <Button asChild variant="destructive">
        <a href="/x">Go</a>
      </Button>,
    );
    const link = screen.getByRole("link");
    expect(styleOf(link)["background-color"]).toBe("var(--destructive)");
  });

  it("keeps a caller's className alongside its own classes", () => {
    render(<Button className="w-full">x</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });

  it("marks itself with data-ui for stable selectors", () => {
    render(<Button>x</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-ui", "button");
  });
});
