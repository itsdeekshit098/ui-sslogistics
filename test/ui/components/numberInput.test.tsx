// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  NumberInput,
  isAcceptable,
  parseNumber,
  formatNumber,
  clamp,
} from "@ui/components/numberInput";
import { styleOf } from "@test/uiStyles";

afterEach(cleanup);

const type = (el: HTMLElement, text: string) => fireEvent.change(el, { target: { value: text } });
const field = () => screen.getByRole("textbox") as HTMLInputElement;

describe("isAcceptable (what can be typed)", () => {
  const ints = { maxDecimals: 0, allowNegative: false };
  const money = { maxDecimals: 2, allowNegative: false };
  const signed = { maxDecimals: 1, allowNegative: true };

  it.each([
    ["", ints, true],
    ["0", ints, true],
    ["123456", ints, true],
    ["1.5", ints, false], // not silently turned into 15
    ["1e20", ints, false], // the exponent form that slipped through type=number
    ["1e20", money, false],
    ["-5", ints, false],
    ["--5", signed, false],
    ["abc", ints, false],
    [" 5", ints, false],
    ["12.", money, true], // partway through typing
    ["12.5", money, true],
    ["12.50", money, true],
    ["12.505", money, false], // a third decimal (sub-paise)
    [".5", money, true],
    ["-", signed, true],
    ["-1.5", signed, true],
    ["-1.55", signed, false],
    ["1234567890123456", ints, false], // too many digits for a double to hold exactly
    ["123456789012345", ints, true],
  ] as const)("%j under %o -> %s", (text, rules, expected) => {
    expect(isAcceptable(text, rules)).toBe(expected);
  });
});

describe("parseNumber / formatNumber / clamp", () => {
  it("treats empty and incomplete text as no number", () => {
    for (const t of ["", "-", ".", "-."]) expect(parseNumber(t)).toBeNull();
    expect(parseNumber("0")).toBe(0);
    expect(parseNumber("12.50")).toBe(12.5);
  });

  it("shows plain digits, with no exponent, grouping or NaN", () => {
    expect(formatNumber(null)).toBe("");
    expect(formatNumber(undefined)).toBe("");
    expect(formatNumber(NaN)).toBe("");
    expect(formatNumber(1500)).toBe("1500");
    expect(formatNumber(1e21)).not.toMatch(/e/i);
    expect(formatNumber(0.0000001)).not.toMatch(/e/i);
  });

  it("clamps into the range", () => {
    expect(clamp(5, 10, 20)).toBe(10);
    expect(clamp(25, 10, 20)).toBe(20);
    expect(clamp(15, 10, 20)).toBe(15);
    expect(clamp(5)).toBe(5);
  });
});

describe("NumberInput", () => {
  it("is a text field with a numeric keyboard, not a type=number input", () => {
    render(<NumberInput aria-label="Qty" />);
    expect(field()).toHaveAttribute("type", "text");
    expect(field()).toHaveAttribute("inputmode", "numeric");
  });

  it("uses the decimal keyboard when decimals are allowed", () => {
    render(<NumberInput aria-label="Rate" maxDecimals={2} />);
    expect(field()).toHaveAttribute("inputmode", "decimal");
  });

  it("reports the number as it is typed, and null when emptied", () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Qty" onValueChange={onValueChange} />);
    type(field(), "4");
    type(field(), "42");
    expect(onValueChange).toHaveBeenLastCalledWith(42);
    type(field(), "");
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it("refuses an invalid change and leaves the field as it was", () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Qty" onValueChange={onValueChange} />);
    type(field(), "12");
    onValueChange.mockClear();
    type(field(), "1e20");
    type(field(), "12.5");
    type(field(), "12a");
    expect(field().value).toBe("12");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("allows decimals up to maxDecimals only", () => {
    render(<NumberInput aria-label="Rate" maxDecimals={2} />);
    type(field(), "1.25");
    expect(field().value).toBe("1.25");
    type(field(), "1.255");
    expect(field().value).toBe("1.25");
  });

  it("accepts a minus sign only when negatives are allowed", () => {
    const { rerender } = render(<NumberInput aria-label="n" min={0} />);
    type(field(), "-3");
    expect(field().value).toBe("");
    rerender(<NumberInput aria-label="n" min={-10} />);
    type(field(), "-3");
    expect(field().value).toBe("-3");
  });

  it("clamps to min and max when it loses focus", () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Pct" min={1} max={100} onValueChange={onValueChange} />);
    type(field(), "250");
    fireEvent.blur(field());
    expect(field().value).toBe("100");
    expect(onValueChange).toHaveBeenLastCalledWith(100);
    type(field(), "0");
    fireEvent.blur(field());
    expect(field().value).toBe("1");
  });

  it("clears a lone minus or dot on blur", () => {
    render(<NumberInput aria-label="n" min={-5} maxDecimals={1} />);
    type(field(), "-");
    fireEvent.blur(field());
    expect(field().value).toBe("");
  });

  it("steps with the arrow keys, within the limits", () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Qty" defaultValue={5} min={0} max={6} step={1} onValueChange={onValueChange} />);
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(field().value).toBe("6");
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(field().value).toBe("6"); // at max
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(onValueChange).toHaveBeenLastCalledWith(5);
  });

  it("steps decimals without floating-point noise", () => {
    render(<NumberInput aria-label="r" defaultValue={0.1} step={0.1} maxDecimals={1} />);
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(field().value).toBe("0.3");
  });

  it("starts from min on the first arrow press of an empty field", () => {
    render(<NumberInput aria-label="Qty" min={1} />);
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(field().value).toBe("1");
  });

  it("controlled: shows the parent's value, and follows an outside change", () => {
    const { rerender } = render(<NumberInput aria-label="n" value={7} onValueChange={() => {}} />);
    expect(field().value).toBe("7");
    rerender(<NumberInput aria-label="n" value={null} onValueChange={() => {}} />);
    expect(field().value).toBe("");
    rerender(<NumberInput aria-label="n" value={12} onValueChange={() => {}} />);
    expect(field().value).toBe("12");
  });

  it("starts from defaultValue", () => {
    render(<NumberInput aria-label="n" defaultValue={9} />);
    expect(field().value).toBe("9");
  });

  it("forwards a ref and takes the input's styling", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<NumberInput aria-label="n" ref={ref} />);
    expect(ref.current).toBe(field());
    expect(styleOf(field()).width).toBe("100%");
  });
});
