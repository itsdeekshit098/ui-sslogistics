// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Checkbox } from "@ui/components/checkbox";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("Checkbox", () => {
  it("is a native checkbox named by its label text", () => {
    render(<Checkbox>Remember me</Checkbox>);
    expect(screen.getByRole("checkbox", { name: "Remember me" })).toBeInTheDocument();
  });

  it("uncontrolled: toggles itself and reports the change", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox onCheckedChange={onCheckedChange}>x</Checkbox>);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(box);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("starts checked with defaultChecked", () => {
    render(<Checkbox defaultChecked>x</Checkbox>);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("controlled: follows `checked` and only reports", () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(<Checkbox checked={false} onCheckedChange={onCheckedChange}>x</Checkbox>);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    rerender(<Checkbox checked onCheckedChange={onCheckedChange}>x</Checkbox>);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("shows the indeterminate state through the DOM property", () => {
    const { rerender } = render(<Checkbox indeterminate>x</Checkbox>);
    expect((screen.getByRole("checkbox") as HTMLInputElement).indeterminate).toBe(true);
    rerender(<Checkbox>x</Checkbox>);
    expect((screen.getByRole("checkbox") as HTMLInputElement).indeterminate).toBe(false);
  });

  it("does not toggle when disabled", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox disabled onCheckedChange={onCheckedChange}>x</Checkbox>);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("forwards a ref to the input", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Checkbox ref={ref}>x</Checkbox>);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("draws a box that fills with the primary colour when checked, with a focus ring", () => {
    render(<Checkbox>x</Checkbox>);
    const box = screen.getByRole("checkbox");
    expect(isInUiLayer(box)).toBe(true);
    expect(styleOf(box).appearance).toBe("none");
    expect(styleOf(box)["border-color"]).toBe("var(--input)");
    expect(styleOf(box, { state: ":checked" })["background-color"]).toBe("var(--primary)");
    expect(styleOf(box, { state: ":focus-visible" })["box-shadow"]).toContain("var(--ring)");
    expect(styleOf(box).width).toBe("1.25rem");
  });

  it("is smaller at size sm and dims its label when disabled", () => {
    const { rerender } = render(<Checkbox size="sm">x</Checkbox>);
    expect(styleOf(screen.getByRole("checkbox")).width).toBe("1rem");
    rerender(<Checkbox disabled>x</Checkbox>);
    const label = screen.getByRole("checkbox").closest("label") as HTMLElement;
    expect(styleOf(label).opacity).toBe("50%");
    expect(styleOf(label).cursor).toBe("not-allowed");
  });
});
