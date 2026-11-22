// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Tabs } from "@ui/components/tabs";
import { styleOf, isInUiLayer } from "@test/uiStyles";

const items = [
  { key: "a", label: "All" },
  { key: "b", label: "Active" },
  { key: "c", label: "Closed", disabled: true },
];

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Tabs", () => {
  it("marks the active tab as selected and others not", () => {
    render(<Tabs items={items} value="a" onValueChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Active" })).toHaveAttribute("aria-selected", "false");
  });

  it("clicking an enabled tab calls onValueChange", () => {
    const onValueChange = vi.fn();
    render(<Tabs items={items} value="a" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Active" }));
    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  it("clicking a disabled tab does not call onValueChange", () => {
    const onValueChange = vi.fn();
    render(<Tabs items={items} value="a" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Closed" }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("ArrowRight from the active tab moves focus to the next enabled tab, skipping disabled", () => {
    render(<Tabs items={items} value="b" onValueChange={vi.fn()} />);
    const active = screen.getByRole("tab", { name: "Active" });
    fireEvent.keyDown(active, { key: "ArrowRight" });
    // Only "a" and "b" are enabled; wraps from b back to a.
    expect(screen.getByRole("tab", { name: "All" })).toHaveFocus();
  });

  it("ArrowLeft wraps to the last enabled tab", () => {
    render(<Tabs items={items} value="a" onValueChange={vi.fn()} />);
    const active = screen.getByRole("tab", { name: "All" });
    fireEvent.keyDown(active, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Active" })).toHaveFocus();
  });

  it("Home/End move focus to the first/last enabled tab", () => {
    render(<Tabs items={items} value="a" onValueChange={vi.fn()} />);
    const active = screen.getByRole("tab", { name: "All" });
    fireEvent.keyDown(active, { key: "End" });
    expect(screen.getByRole("tab", { name: "Active" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Active" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: "All" })).toHaveFocus();
  });

  it("Enter/Space on a focused tab calls onValueChange for that tab's index", () => {
    const onValueChange = vi.fn();
    render(<Tabs items={items} value="a" onValueChange={onValueChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "All" }), { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith("a");
  });

  it("only the active tab is in the natural tab order", () => {
    render(<Tabs items={items} value="a" onValueChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("tabIndex", "0");
    expect(screen.getByRole("tab", { name: "Active" })).toHaveAttribute("tabIndex", "-1");
  });

  it("renders a badge when provided", () => {
    render(
      <Tabs
        items={[{ key: "a", label: "All", badge: 5 }]}
        value="a"
        onValueChange={vi.fn()}
      />,
    );
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});

describe("Tabs styles", () => {
  const phone = "(max-width: 767.98px)";
  const items = [
    { key: "a", label: "Alpha", badge: 3 },
    { key: "b", label: "Beta" },
    { key: "c", label: "Gamma", disabled: true },
  ];

  it("is a grey scrolling track on desktop and a bare row of chips on phones", () => {
    render(<Tabs items={items} value="a" onValueChange={() => {}} />);
    const track = screen.getByRole("tablist");
    expect(isInUiLayer(track)).toBe(true);
    expect(styleOf(track)["background-color"]).toBe("var(--muted)");
    expect(styleOf(track)["overflow-x"]).toBe("auto");
    expect(styleOf(track, { media: phone })["background-color"]).toBe("transparent");
    expect(track.getAttribute("style")).toBeNull();
  });

  it("raises the active tab on desktop and fills it with the primary colour on phones", () => {
    render(<Tabs items={items} value="a" onValueChange={() => {}} />);
    const active = screen.getByRole("tab", { name: /alpha/i });
    const idle = screen.getByRole("tab", { name: /beta/i });
    expect(styleOf(active)["background-color"]).toBe("var(--card)");
    expect(styleOf(idle).color).toBe("var(--muted-foreground)");
    expect(styleOf(active, { media: phone })["background-color"]).toBe("var(--primary)");
    expect(styleOf(idle, { media: phone })["border-color"]).toBe("var(--border)");
  });

  it("dims a disabled tab", () => {
    render(<Tabs items={items} value="a" onValueChange={() => {}} />);
    expect(styleOf(screen.getByRole("tab", { name: /gamma/i })).opacity).toBe("50%");
  });
});