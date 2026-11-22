// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { Calendar, DatePicker } from "@ui/components/datePicker";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

const TODAY = "2026-06-15";

describe("Calendar", () => {
  it("follows a value that changes from outside, showing its month", () => {
    const { rerender } = render(<Calendar value="2026-03-10" today={TODAY} onSelect={() => {}} />);
    expect(screen.getByRole("grid", { name: "March 2026" })).toBeInTheDocument();
    rerender(<Calendar value="2026-09-02" today={TODAY} onSelect={() => {}} />);
    expect(screen.getByRole("grid", { name: "September 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wednesday, 2 September 2026" })).toHaveAttribute("tabindex", "0");
  });

  const day = (label: string | RegExp) => screen.getByRole("button", { name: label });

  it("shows the month of the value, with a labelled grid and weekday headers", () => {
    render(<Calendar value="2026-03-10" today={TODAY} onSelect={() => {}} />);
    expect(screen.getByRole("grid", { name: "March 2026" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
  });

  it("starts on today's month when there is no value", () => {
    render(<Calendar value={null} today={TODAY} onSelect={() => {}} />);
    expect(screen.getByRole("grid", { name: "June 2026" })).toBeInTheDocument();
  });

  it("selects a day and names each day in full for screen readers", () => {
    const onSelect = vi.fn();
    render(<Calendar value={null} today={TODAY} onSelect={onSelect} />);
    fireEvent.click(day("Wednesday, 17 June 2026"));
    expect(onSelect).toHaveBeenCalledWith("2026-06-17");
  });

  it("marks the selected day and today", () => {
    render(<Calendar value="2026-06-20" today={TODAY} onSelect={() => {}} />);
    expect(day("Saturday, 20 June 2026")).toHaveAttribute("aria-selected", "true");
    expect(day("Monday, 15 June 2026")).toHaveAttribute("aria-current", "date");
  });

  it("puts only one day in the tab order", () => {
    render(<Calendar value="2026-06-20" today={TODAY} onSelect={() => {}} />);
    const tabbable = screen.getAllByRole("button").filter((b) => b.getAttribute("tabindex") === "0");
    expect(tabbable.filter((b) => b.getAttribute("aria-label")?.includes("2026"))).toHaveLength(1);
    expect(day("Saturday, 20 June 2026")).toHaveAttribute("tabindex", "0");
  });

  it("moves between months from the header buttons", () => {
    render(<Calendar value="2026-06-15" today={TODAY} onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("grid", { name: "July 2026" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("grid", { name: "May 2026" })).toBeInTheDocument();
  });

  it("changes year across December (and keeps the day clamped)", () => {
    render(<Calendar value="2026-12-31" today={TODAY} onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("grid", { name: "January 2027" })).toBeInTheDocument();
  });

  it("disables days outside min and max, and never selects them", () => {
    const onSelect = vi.fn();
    render(<Calendar value="2026-06-15" today={TODAY} min="2026-06-10" max="2026-06-20" onSelect={onSelect} />);
    expect(day("Tuesday, 9 June 2026")).toBeDisabled();
    expect(day("Sunday, 21 June 2026")).toBeDisabled();
    expect(day("Wednesday, 10 June 2026")).toBeEnabled();
    fireEvent.click(day("Tuesday, 9 June 2026"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  describe("keyboard", () => {
    const press = (key: string, extra: object = {}) => fireEvent.keyDown(screen.getByRole("grid"), { key, ...extra });
    const focusedLabel = () => document.activeElement?.getAttribute("aria-label");

    it("arrows move by a day or a week", () => {
      render(<Calendar value="2026-06-15" today={TODAY} onSelect={() => {}} autoFocus />);
      press("ArrowRight");
      expect(focusedLabel()).toBe("Tuesday, 16 June 2026");
      press("ArrowLeft");
      press("ArrowLeft");
      expect(focusedLabel()).toBe("Sunday, 14 June 2026");
      press("ArrowDown");
      expect(focusedLabel()).toBe("Sunday, 21 June 2026");
      press("ArrowUp");
      press("ArrowUp");
      expect(focusedLabel()).toBe("Sunday, 7 June 2026");
    });

    it("moves across a month boundary and changes the grid", () => {
      render(<Calendar value="2026-06-30" today={TODAY} onSelect={() => {}} autoFocus />);
      press("ArrowRight");
      expect(focusedLabel()).toBe("Wednesday, 1 July 2026");
      expect(screen.getByRole("grid", { name: "July 2026" })).toBeInTheDocument();
    });

    it("stops at the last allowed day instead of moving onto a disabled one", () => {
      render(<Calendar value="2026-06-20" max="2026-06-20" today={TODAY} onSelect={() => {}} autoFocus />);
      press("ArrowRight");
      expect(focusedLabel()).toBe("Saturday, 20 June 2026");
      expect(document.activeElement).toHaveAttribute("aria-label", "Saturday, 20 June 2026");
    });

    it("Home and End go to the ends of the week (Sunday to Saturday)", () => {
      render(<Calendar value="2026-06-17" today={TODAY} onSelect={() => {}} autoFocus />);
      press("Home");
      expect(focusedLabel()).toBe("Sunday, 14 June 2026");
      press("End");
      expect(focusedLabel()).toBe("Saturday, 20 June 2026");
    });

    it("Home and End respect a Monday week start", () => {
      render(<Calendar value="2026-06-17" today={TODAY} weekStartsOn={1} onSelect={() => {}} autoFocus />);
      press("Home");
      expect(focusedLabel()).toBe("Monday, 15 June 2026");
      press("End");
      expect(focusedLabel()).toBe("Sunday, 21 June 2026");
    });

    it("PageUp/PageDown change the month, and with Shift the year", () => {
      render(<Calendar value="2026-06-15" today={TODAY} onSelect={() => {}} autoFocus />);
      press("PageDown");
      expect(focusedLabel()).toBe("Wednesday, 15 July 2026");
      press("PageUp", { shiftKey: true });
      expect(focusedLabel()).toBe("Tuesday, 15 July 2025");
    });

    it("chooses the focused day with Enter (a button's own activation)", () => {
      const onSelect = vi.fn();
      render(<Calendar value="2026-06-15" today={TODAY} onSelect={onSelect} autoFocus />);
      press("ArrowRight");
      fireEvent.click(document.activeElement!);
      expect(onSelect).toHaveBeenCalledWith("2026-06-16");
    });
  });
});

describe("DatePicker", () => {
  const trigger = () => document.querySelector<HTMLButtonElement>('[data-ui="date-picker"] > button[aria-haspopup]')!;

  it("shows the placeholder, then the chosen date in a readable form", () => {
    const { rerender } = render(<DatePicker today={TODAY} value={null} />);
    expect(screen.getByRole("button", { name: /Select date/ })).toBeInTheDocument();
    rerender(<DatePicker today={TODAY} value="2026-06-05" />);
    expect(screen.getByRole("button", { name: /5 Jun 2026/ })).toBeInTheDocument();
  });

  it("opens a calendar dialog on click and says so", () => {
    render(<DatePicker today={TODAY} />);
    expect(trigger()).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("choosing a day sets the value, closes the popup and returns focus", () => {
    const onValueChange = vi.fn();
    render(<DatePicker today={TODAY} onValueChange={onValueChange} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: "Wednesday, 17 June 2026" }));
    expect(onValueChange).toHaveBeenCalledWith("2026-06-17");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /17 Jun 2026/ })).toBe(document.activeElement);
  });

  it("controlled: only reports; shows the parent's value", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<DatePicker today={TODAY} value="2026-06-01" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("button", { name: /1 Jun 2026/ }));
    fireEvent.click(screen.getByRole("button", { name: "Wednesday, 17 June 2026" }));
    expect(onValueChange).toHaveBeenCalledWith("2026-06-17");
    expect(screen.getByRole("button", { name: /1 Jun 2026/ })).toBeInTheDocument();
    rerender(<DatePicker today={TODAY} value="2026-06-17" onValueChange={onValueChange} />);
    expect(screen.getByRole("button", { name: /17 Jun 2026/ })).toBeInTheDocument();
  });

  it("the Today shortcut picks today (the supplied business day, not the machine's)", () => {
    const onValueChange = vi.fn();
    render(<DatePicker today="2031-01-02" onValueChange={onValueChange} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(onValueChange).toHaveBeenCalledWith("2031-01-02");
  });

  it("Today is disabled when it is outside min/max", () => {
    render(<DatePicker today={TODAY} max="2026-06-01" />);
    fireEvent.click(trigger());
    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
  });

  it("can clear the value when clearable", () => {
    const onValueChange = vi.fn();
    render(<DatePicker today={TODAY} clearable value="2026-06-05" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("button", { name: /5 Jun 2026/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it("has no Clear button unless clearable", () => {
    render(<DatePicker today={TODAY} />);
    fireEvent.click(trigger());
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("ignores a malformed value rather than showing it", () => {
    render(<DatePicker today={TODAY} value="2026-02-30" />);
    expect(screen.getByRole("button", { name: /Select date/ })).toBeInTheDocument();
  });

  it("does not open when disabled", () => {
    render(<DatePicker today={TODAY} disabled />);
    fireEvent.click(trigger());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("marks an invalid field", () => {
    render(<DatePicker today={TODAY} invalid />);
    expect(trigger()).toHaveAttribute("aria-invalid", "true");
    expect(styleOf(trigger())["border-color"]).toBe("var(--destructive)");
  });

  it("looks like an input: bordered field, 44px (40px on desktop), placeholder colour when empty", () => {
    render(<DatePicker today={TODAY} />);
    const css = styleOf(trigger());
    expect(isInUiLayer(trigger())).toBe(true);
    expect(css["border-color"]).toBe("var(--input)");
    expect(css.height).toBe("var(--input-height-lg)");
    expect(css.color).toBe("var(--placeholder-foreground)");
    expect(styleOf(trigger(), { media: "(min-width: 768px)" }).height).toBe("var(--input-height)");
  });

  it("styles the selected day and today in the grid", () => {
    render(<DatePicker today={TODAY} value="2026-06-20" />);
    fireEvent.click(screen.getByRole("button", { name: /20 Jun 2026/ }));
    const dialog = screen.getByRole("dialog");
    expect(styleOf(within(dialog).getByRole("button", { name: "Saturday, 20 June 2026" }))["background-color"]).toBe("var(--primary)");
    expect(styleOf(within(dialog).getByRole("button", { name: "Monday, 15 June 2026" }))["font-weight"]).toBe("700");
  });

  it("forwards a ref to the trigger", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<DatePicker today={TODAY} ref={ref} />);
    expect(ref.current).toBe(trigger());
  });
});
