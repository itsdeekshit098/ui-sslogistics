// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StatCard } from "@/components/ui/statCard/statCard";

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

  it("colors the value text for the critical tone", () => {
    render(<StatCard title="Overdue" value="5" icon={icon} tone="critical" />);
    expect(screen.getByText("5").className).toContain("text-destructive");
  });

  it("does not color the value for the neutral/positive/warning tones", () => {
    render(<StatCard title="OK" value="5" icon={icon} tone="positive" />);
    expect(screen.getByText("5").className).not.toContain("text-destructive");
  });

  it("renders subtext only when provided", () => {
    const { rerender } = render(<StatCard title="Revenue" value="1" icon={icon} />);
    expect(screen.queryByText("so far")).toBeNull();
    rerender(<StatCard title="Revenue" value="1" icon={icon} subtext="so far" />);
    expect(screen.getByText("so far")).toBeInTheDocument();
  });
});
