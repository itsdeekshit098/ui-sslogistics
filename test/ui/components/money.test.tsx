// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Money } from "@ui/components/money";
import { styleOf, isInUiLayer } from "@test/uiStyles";

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

  it("colours a negative amount with the destructive colour", () => {
    render(<Money value={100} tone="negative" />);
    expect(styleOf(screen.getByText("₹100")).color).toBe("var(--destructive)");
  });

  it("colours a positive amount with the success text colour", () => {
    render(<Money value={100} tone="positive" />);
    expect(styleOf(screen.getByText("₹100")).color).toBe("var(--success-subtle-foreground)");
  });

  it("leaves a neutral amount in the inherited colour", () => {
    render(<Money value={100} tone="neutral" />);
    expect(styleOf(screen.getByText("₹100")).color).toBeUndefined();
  });

  it("sets tabular digits so a column of amounts lines up", () => {
    render(<Money value={100} />);
    const el = screen.getByText("₹100");
    expect(styleOf(el)["font-variant-numeric"]).toBe("tabular-nums");
    expect(isInUiLayer(el)).toBe(true);
  });

  it("keeps a caller's className", () => {
    render(<Money value={100} className="text-right" />);
    expect(screen.getByText("₹100")).toHaveClass("text-right");
  });
});
