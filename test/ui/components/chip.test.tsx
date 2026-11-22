// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Chip } from "@ui/components/chip";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("Chip", () => {
  it("is plain text in a pill without onClick", () => {
    render(<Chip>Active</Chip>);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("becomes a toggle button with onClick, reflecting `selected`", () => {
    const onClick = vi.fn();
    const { rerender } = render(<Chip onClick={onClick}>Overdue</Chip>);
    const chip = screen.getByRole("button", { name: "Overdue" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<Chip onClick={onClick} selected>Overdue</Chip>);
    expect(screen.getByRole("button", { name: "Overdue" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a labelled remove button that does not trigger the chip's own click", () => {
    const onRemove = vi.fn();
    const onClick = vi.fn();
    render(<Chip onRemove={onRemove} removeLabel="Remove Chennai" onClick={onClick}>Chennai</Chip>);
    fireEvent.click(screen.getByRole("button", { name: "Remove Chennai" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("has no remove button without onRemove", () => {
    render(<Chip>x</Chip>);
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("does not respond when disabled", () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick} disabled>x</Chip>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each([
    ["success", "var(--success-subtle)", "var(--success-subtle-foreground)"],
    ["danger", "var(--destructive-subtle)", "var(--destructive-subtle-foreground)"],
    ["neutral", "var(--muted)", "var(--muted-foreground)"],
  ] as const)("subtle %s is a soft tint", (tone, bg, fg) => {
    render(<Chip tone={tone}>x</Chip>);
    const chip = screen.getByText("x");
    expect(isInUiLayer(chip)).toBe(true);
    expect(styleOf(chip)["background-color"]).toBe(bg);
    expect(styleOf(chip).color).toBe(fg);
    expect(styleOf(chip)["border-radius"]).toBe("9999px");
  });

  it("solid and a selected chip fill with the tone", () => {
    const { rerender } = render(<Chip tone="primary" variant="solid">x</Chip>);
    expect(styleOf(screen.getByText("x"))["background-color"]).toBe("var(--primary)");
    rerender(<Chip tone="danger" onClick={() => {}} selected>x</Chip>);
    expect(styleOf(screen.getByRole("button"))["background-color"]).toBe("var(--destructive)");
  });

  it("outline has no fill", () => {
    render(<Chip variant="outline">x</Chip>);
    expect(styleOf(screen.getByText("x"))["background-color"]).toBe("transparent");
  });

  it("is smaller at size sm", () => {
    const { rerender } = render(<Chip>x</Chip>);
    const md = styleOf(screen.getByText("x"))["font-size"];
    rerender(<Chip size="sm">x</Chip>);
    expect(styleOf(screen.getByText("x"))["font-size"]).not.toBe(md);
  });
});
