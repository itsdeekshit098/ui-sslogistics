// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Input } from "@/components/ui/input";

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
