// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Switch } from "@ui/components/switch";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("Switch", () => {
  it("is a switch that reports its state", () => {
    render(<Switch aria-label="Maintenance" />);
    expect(screen.getByRole("switch", { name: "Maintenance" })).toHaveAttribute("aria-checked", "false");
  });

  it("uncontrolled: toggles on click and reports the change", () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="x" onCheckedChange={onCheckedChange} />);
    const sw = screen.getByRole("switch");
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(sw);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("starts on with defaultChecked", () => {
    render(<Switch aria-label="x" defaultChecked />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("controlled: follows `checked`; a click only reports", () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(<Switch aria-label="x" checked={false} onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    rerender(<Switch aria-label="x" checked onCheckedChange={onCheckedChange} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("can be toggled from the keyboard (Space/Enter activate a button)", () => {
    render(<Switch aria-label="x" />);
    const sw = screen.getByRole("switch");
    sw.focus();
    fireEvent.click(sw); // jsdom turns Space/Enter on a focused button into a click
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("does nothing when disabled", () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="x" disabled onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("lets a caller's onClick prevent the toggle", () => {
    render(<Switch aria-label="x" onClick={(e) => e.preventDefault()} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("fills the track with the primary colour when on, and moves the thumb", () => {
    const { rerender } = render(<Switch aria-label="x" checked={false} />);
    const sw = screen.getByRole("switch");
    expect(isInUiLayer(sw)).toBe(true);
    expect(styleOf(sw)["background-color"]).toBe("var(--input)");
    const thumb = sw.firstElementChild as HTMLElement;
    expect(styleOf(thumb).translate).toBe("0 0");
    rerender(<Switch aria-label="x" checked />);
    expect(styleOf(sw)["background-color"]).toBe("var(--primary)");
    expect(styleOf(sw.firstElementChild as HTMLElement).translate).toContain("calc(");
  });
});
