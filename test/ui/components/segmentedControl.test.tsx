// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SegmentedControl } from "@ui/components/segmentedControl";
import { styleOf, isInUiLayer } from "@test/uiStyles";

const items = [
  { key: "all", label: "All" },
  { key: "active", label: "Active", count: 3 },
  { key: "closed", label: "Closed" },
];

afterEach(cleanup);

describe("SegmentedControl", () => {
  it("marks the selected item with aria-checked", () => {
    render(<SegmentedControl items={items} value="active" onValueChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /active/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /all/i })).toHaveAttribute("aria-checked", "false");
  });

  it("renders a count badge when provided", () => {
    render(<SegmentedControl items={items} value="all" onValueChange={vi.fn()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("clicking an item calls onValueChange with its key", () => {
    const onValueChange = vi.fn();
    render(<SegmentedControl items={items} value="all" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /closed/i }));
    expect(onValueChange).toHaveBeenCalledWith("closed");
  });

  it("ArrowRight wraps from the last item to the first", () => {
    const onValueChange = vi.fn();
    render(<SegmentedControl items={items} value="closed" onValueChange={onValueChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: /closed/i }), { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenCalledWith("all");
  });

  it("ArrowLeft wraps from the first item to the last", () => {
    const onValueChange = vi.fn();
    render(<SegmentedControl items={items} value="all" onValueChange={onValueChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: /all/i }), { key: "ArrowLeft" });
    expect(onValueChange).toHaveBeenCalledWith("closed");
  });

  it("Home/End select the first/last item regardless of current position", () => {
    const onValueChange = vi.fn();
    render(<SegmentedControl items={items} value="active" onValueChange={onValueChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: /active/i }), { key: "End" });
    expect(onValueChange).toHaveBeenLastCalledWith("closed");
    fireEvent.keyDown(screen.getByRole("radio", { name: /active/i }), { key: "Home" });
    expect(onValueChange).toHaveBeenLastCalledWith("all");
  });

  it("disabled disables every button and prevents clicks' default styling from implying interactivity", () => {
    render(<SegmentedControl items={items} value="all" onValueChange={vi.fn()} disabled />);
    for (const item of items) {
      expect(screen.getByRole("radio", { name: new RegExp(item.label, "i") })).toBeDisabled();
    }
  });

  it("an unrecognized key does nothing", () => {
    const onValueChange = vi.fn();
    render(<SegmentedControl items={items} value="all" onValueChange={onValueChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: /all/i }), { key: "Escape" });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("SegmentedControl styles", () => {
  const phone = "(max-width: 767.98px)";
  const items = [
    { key: "all", label: "All", count: 5 },
    { key: "open", label: "Open" },
  ];

  it("shares the tab strip's look: a grey track on desktop, chips on phones", () => {
    render(<SegmentedControl items={items} value="all" onValueChange={() => {}} />);
    const group = screen.getByRole("radiogroup");
    expect(isInUiLayer(group)).toBe(true);
    expect(styleOf(group)["background-color"]).toBe("var(--muted)");
    expect(styleOf(group, { media: phone })["background-color"]).toBe("transparent");
  });

  it("marks the selected segment", () => {
    render(<SegmentedControl items={items} value="all" onValueChange={() => {}} />);
    const selected = screen.getByRole("radio", { name: /all/i });
    expect(styleOf(selected)["background-color"]).toBe("var(--card)");
    expect(styleOf(selected, { media: phone })["background-color"]).toBe("var(--primary)");
    expect(styleOf(screen.getByRole("radio", { name: "Open" })).color).toBe("var(--muted-foreground)");
  });

  it("dims every segment when disabled", () => {
    render(<SegmentedControl items={items} value="all" onValueChange={() => {}} disabled />);
    expect(styleOf(screen.getByRole("radio", { name: "Open" }), { state: ":disabled" }).opacity).toBe("60%");
  });
});