// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Input } from "@ui/components/input";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("Input", () => {
  it("blurs a number input on wheel to prevent scroll-to-increment", () => {
    render(<Input type="number" aria-label="qty" defaultValue={1} />);
    const input = screen.getByLabelText("qty") as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.wheel(input);

    expect(document.activeElement).not.toBe(input);
  });

  it("does not blur a text input on wheel", () => {
    render(<Input type="text" aria-label="name" defaultValue="" />);
    const input = screen.getByLabelText("name") as HTMLInputElement;
    input.focus();

    fireEvent.wheel(input);

    expect(document.activeElement).toBe(input);
  });

  it("still calls a caller-provided onWheel handler", () => {
    const onWheel = vi.fn();
    render(<Input type="number" aria-label="qty" onWheel={onWheel} />);
    fireEvent.wheel(screen.getByLabelText("qty"));
    expect(onWheel).toHaveBeenCalledTimes(1);
  });

  it("forwards a ref to the underlying input element", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} aria-label="x" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});

describe("Input styles", () => {
  it("is a full-width bordered field in the ui layer", () => {
    render(<Input aria-label="x" />);
    const input = screen.getByLabelText("x");
    expect(isInUiLayer(input)).toBe(true);
    const css = styleOf(input);
    expect(css.width).toBe("100%");
    expect(css["border-color"]).toBe("var(--input)");
    expect(css["border-radius"]).toBe("var(--input-radius)");
    expect(css["background-color"]).toBe("var(--background)");
  });

  it("is 44px tall, 40px on desktop", () => {
    render(<Input aria-label="x" />);
    const input = screen.getByLabelText("x");
    expect(styleOf(input).height).toBe("var(--input-height-lg)");
    expect(styleOf(input, { media: "(min-width: 768px)" }).height).toBe("var(--input-height)");
  });

  it("takes the card colour on phones and 14px type on desktop", () => {
    render(<Input aria-label="x" />);
    const input = screen.getByLabelText("x");
    expect(styleOf(input, { media: "(max-width: 767.98px)" })["background-color"]).toBe("var(--card)");
    expect(styleOf(input, { media: "(min-width: 768px)" })["font-size"]).toBe("0.875rem");
  });

  it("dims when disabled and colours its placeholder", () => {
    render(<Input aria-label="x" />);
    const input = screen.getByLabelText("x");
    expect(styleOf(input, { state: ":disabled" }).opacity).toBe("50%");
    expect(styleOf(input, { state: "::placeholder" }).color).toBe("var(--placeholder-foreground)");
  });

  it("keeps a caller's className", () => {
    render(<Input aria-label="x" className="max-w-sm" />);
    expect(screen.getByLabelText("x")).toHaveClass("max-w-sm");
  });
});
