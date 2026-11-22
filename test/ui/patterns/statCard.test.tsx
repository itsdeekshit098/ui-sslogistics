// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StatCard } from "@ui/patterns/statCard";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

const icon = <svg data-testid="stat-icon" />;

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="Revenue" value="₹1,000" icon={icon} />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("₹1,000")).toBeInTheDocument();
  });

  it("is not a button/interactive element without onClick", () => {
    render(<StatCard title="Revenue" value="₹1,000" icon={icon} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("becomes a button and fires onClick when provided", () => {
    const onClick = vi.fn();
    render(<StatCard title="Revenue" value="₹1,000" icon={icon} onClick={onClick} />);
    const card = screen.getByRole("button");
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard activation (Enter/Space) when interactive", () => {
    const onClick = vi.fn();
    render(<StatCard title="Revenue" value="₹1,000" icon={icon} onClick={onClick} />);
    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(card, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("colours the headline value only for the critical tone", () => {
    const { rerender } = render(<StatCard title="Overdue" value="5" icon={icon} tone="critical" />);
    expect(styleOf(screen.getByText("5")).color).toBe("var(--destructive)");
    rerender(<StatCard title="OK" value="5" icon={icon} tone="positive" />);
    expect(styleOf(screen.getByText("5")).color).toBe("var(--foreground)");
  });

  it("gives each tone its own chip colours and border", () => {
    const { container, rerender } = render(<StatCard title="t" value="1" icon={icon} tone="positive" />);
    const chip = () => screen.getByTestId("stat-icon").parentElement!;
    expect(styleOf(chip())["background-color"]).toBe("var(--success-subtle)");
    expect(styleOf(chip()).color).toBe("var(--success-subtle-foreground)");
    expect(styleOf(container.firstElementChild!)["border-color"]).toBe("var(--border)");
    rerender(<StatCard title="t" value="1" icon={icon} tone="warning" />);
    expect(styleOf(chip())["background-color"]).toBe("var(--warning-subtle)");
    expect(styleOf(container.firstElementChild!)["border-color"]).toContain("color-mix");
    rerender(<StatCard title="t" value="1" icon={icon} tone="critical" />);
    expect(styleOf(chip())["background-color"]).toBe("var(--destructive-subtle)");
  });

  it("becomes a compact summary-strip tile on phones, with the icon hidden and the value coloured", () => {
    const { container } = render(<StatCard title="t" value="7" icon={icon} tone="positive" />);
    const phone = "(max-width: 767.98px)";
    const root = container.firstElementChild!;
    expect(styleOf(root, { media: phone })["align-items"]).toBe("center");
    expect(styleOf(root, { media: phone })["border-radius"]).toBe("var(--m-radius-control)");
    expect(styleOf(screen.getByTestId("stat-icon").parentElement!, { media: phone }).display).toBe("none");
    expect(styleOf(screen.getByText("7"), { media: phone }).color).toBe("var(--success)");
    expect(styleOf(screen.getByText("7"), { media: phone }).order).toBe("1");
  });

  it("carries data-ui so the stylesheet can lay a row of them out as a strip", () => {
    const { container } = render(<StatCard title="t" value="1" icon={icon} />);
    expect(container.firstElementChild).toHaveAttribute("data-ui", "stat-card");
    expect(isInUiLayer(container.firstElementChild!)).toBe(true);
  });

  it("is only clickable-looking when interactive, with a focus ring", () => {
    const { container, rerender } = render(<StatCard title="t" value="1" icon={icon} />);
    expect(styleOf(container.firstElementChild!).cursor).toBeUndefined();
    rerender(<StatCard title="t" value="1" icon={icon} onClick={() => {}} />);
    const root = container.firstElementChild!;
    expect(styleOf(root).cursor).toBe("pointer");
    expect(styleOf(root, { state: ":focus-visible" })["box-shadow"]).toContain("var(--ring)");
  });

  it("keeps the legacy highlightColor stripe (sm and up) and icon colours for callers not on `tone`", () => {
    const { container } = render(
      <StatCard title="t" value="1" icon={icon} highlightColor="#f00" iconBgColor="#0f0" iconColor="#00f" />,
    );
    expect(styleOf(container.firstElementChild!, { media: "(min-width: 640px)" })["border-left-color"]).toBe("#f00");
    const chip = screen.getByTestId("stat-icon").parentElement!;
    expect(styleOf(chip)["background-color"]).toBe("#0f0");
    expect(styleOf(chip).color).toBe("#00f");
    expect(container.firstElementChild!.getAttribute("style")).toBeNull();
  });

  it("renders subtext only when provided", () => {
    const { rerender } = render(<StatCard title="Revenue" value="1" icon={icon} />);
    expect(screen.queryByText("so far")).toBeNull();
    rerender(<StatCard title="Revenue" value="1" icon={icon} subtext="so far" />);
    expect(screen.getByText("so far")).toBeInTheDocument();
  });
});
