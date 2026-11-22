// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MoneyInput, MAX_MONEY } from "@ui/components/moneyInput";
import { styleOf } from "@test/uiStyles";

afterEach(cleanup);

const type = (el: HTMLElement, text: string) => fireEvent.change(el, { target: { value: text } });
const field = () => screen.getByRole("textbox") as HTMLInputElement;

describe("MoneyInput", () => {
  it("shows the rupee sign inside the field and leaves room for it", () => {
    render(<MoneyInput aria-label="Amount" />);
    expect(screen.getByText("₹")).toHaveAttribute("aria-hidden", "true");
    expect(styleOf(field())["padding-left"]).toBe("var(--space-8)");
  });

  it("accepts whole rupees and paise", () => {
    const onValueChange = vi.fn();
    render(<MoneyInput aria-label="Amount" onValueChange={onValueChange} />);
    type(field(), "1500");
    expect(onValueChange).toHaveBeenLastCalledWith(1500);
    type(field(), "1500.5");
    expect(onValueChange).toHaveBeenLastCalledWith(1500.5);
    type(field(), "1500.50");
    expect(field().value).toBe("1500.50");
  });

  it("refuses three decimals, an exponent and a negative", () => {
    render(<MoneyInput aria-label="Amount" />);
    type(field(), "100");
    type(field(), "100.123");
    type(field(), "1e20");
    type(field(), "-100");
    expect(field().value).toBe("100");
  });

  it("caps at a billion rupees by default, and at a custom max", () => {
    const { rerender } = render(<MoneyInput aria-label="Amount" />);
    type(field(), "5000000000");
    fireEvent.blur(field());
    expect(field().value).toBe(String(MAX_MONEY));
    rerender(<MoneyInput aria-label="Amount" max={500} />);
    type(field(), "900");
    fireEvent.blur(field());
    expect(field().value).toBe("500");
  });

  it("reports null for an empty amount, not 0", () => {
    const onValueChange = vi.fn();
    render(<MoneyInput aria-label="Amount" defaultValue={5} onValueChange={onValueChange} />);
    type(field(), "");
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it("never goes below zero from the keyboard", () => {
    render(<MoneyInput aria-label="Amount" defaultValue={0} />);
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(field().value).toBe("0");
  });

  it("takes a different currency symbol", () => {
    render(<MoneyInput aria-label="Amount" symbol="$" />);
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("forwards a ref", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<MoneyInput aria-label="Amount" ref={ref} />);
    expect(ref.current).toBe(field());
  });
});
