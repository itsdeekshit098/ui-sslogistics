// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MonthPicker } from "@ui/components/monthPicker";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

const NOW = "2026-06";
const trigger = () => document.querySelector<HTMLButtonElement>('[data-ui="month-picker"] > button[aria-haspopup]')!;

describe("MonthPicker", () => {
  it("shows a placeholder, then the chosen month", () => {
    const { rerender } = render(<MonthPicker currentMonth={NOW} value={null} />);
    expect(screen.getByRole("button", { name: /Select month/ })).toBeInTheDocument();
    rerender(<MonthPicker currentMonth={NOW} value="2026-03" />);
    expect(screen.getByRole("button", { name: /Mar 2026/ })).toBeInTheDocument();
  });

  it("opens on the year of the value, or the current month's year", () => {
    const { unmount } = render(<MonthPicker currentMonth={NOW} value="2024-11" />);
    fireEvent.click(trigger());
    expect(screen.getByText("2024")).toBeInTheDocument();
    unmount();
    render(<MonthPicker currentMonth={NOW} />);
    fireEvent.click(trigger());
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("offers the twelve months of the year, and changes year", () => {
    render(<MonthPicker currentMonth={NOW} />);
    fireEvent.click(trigger());
    expect(screen.getAllByRole("button", { name: /^\w{3,4} 2026$/ })).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Next year" }));
    expect(screen.getByRole("button", { name: "Jan 2027" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous year" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous year" }));
    expect(screen.getByRole("button", { name: "Jan 2025" })).toBeInTheDocument();
  });

  it("choosing a month reports YYYY-MM, closes the popup and returns focus", () => {
    const onValueChange = vi.fn();
    render(<MonthPicker currentMonth={NOW} onValueChange={onValueChange} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: "Feb 2026" }));
    expect(onValueChange).toHaveBeenCalledWith("2026-02");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Feb 2026/ }));
  });

  it("marks the selected and current months", () => {
    render(<MonthPicker currentMonth={NOW} value="2026-03" />);
    fireEvent.click(trigger());
    const panel = within(document.querySelector('[data-ui="month-panel"]') as HTMLElement);
    expect(panel.getByRole("button", { name: "Mar 2026" })).toHaveAttribute("aria-pressed", "true");
    expect(styleOf(panel.getByRole("button", { name: "Mar 2026" }))["background-color"]).toBe("var(--primary)");
    expect(styleOf(panel.getByRole("button", { name: "Jun 2026" }))["font-weight"]).toBe("700");
  });

  it("disables months outside min and max", () => {
    render(<MonthPicker currentMonth={NOW} min="2026-03" max="2026-09" />);
    fireEvent.click(trigger());
    expect(screen.getByRole("button", { name: "Feb 2026" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Oct 2026" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mar 2026" })).toBeEnabled();
  });

  it("the shortcut picks the supplied current month", () => {
    const onValueChange = vi.fn();
    render(<MonthPicker currentMonth="2031-04" onValueChange={onValueChange} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    expect(onValueChange).toHaveBeenCalledWith("2031-04");
  });

  it("clears when clearable", () => {
    const onValueChange = vi.fn();
    render(<MonthPicker currentMonth={NOW} value="2026-03" clearable onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Mar 2026/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it("ignores a malformed value", () => {
    render(<MonthPicker currentMonth={NOW} value="2026-13" />);
    expect(screen.getByRole("button", { name: /Select month/ })).toBeInTheDocument();
  });

  it("is an input-looking trigger", () => {
    render(<MonthPicker currentMonth={NOW} />);
    expect(isInUiLayer(trigger())).toBe(true);
    expect(styleOf(trigger())["border-color"]).toBe("var(--input)");
  });
});
