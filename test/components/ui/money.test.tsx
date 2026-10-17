// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Money } from "@/components/ui/money/money";

afterEach(cleanup);

describe("Money", () => {
  it("renders the rounded currency format by default", () => {
    render(<Money value={1234.5} />);
    expect(screen.getByText("₹1,235")).toBeInTheDocument();
  });

  it("renders the precise (2-decimal) format when precise=true", () => {
    render(<Money value={1234.5} precise />);
    expect(screen.getByText("₹1,234.50")).toBeInTheDocument();
  });

  it("renders an em dash for null", () => {
    render(<Money value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("applies the negative tone color class", () => {
    render(<Money value={100} tone="negative" />);
    expect(screen.getByText("₹100").className).toContain("text-destructive");
  });

  it("applies the positive tone color class", () => {
    render(<Money value={100} tone="positive" />);
    expect(screen.getByText("₹100").className).toContain("text-success");
  });

  it("neutral tone adds no color class", () => {
    render(<Money value={100} tone="neutral" />);
    const el = screen.getByText("₹100");
    expect(el.className).not.toContain("text-destructive");
    expect(el.className).not.toContain("text-success");
  });
});
