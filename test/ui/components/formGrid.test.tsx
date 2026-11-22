// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FormGrid } from "@ui/components/formGrid";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("FormGrid", () => {
  it("is a single column with a 16px gap on phones", () => {
    render(<FormGrid data-testid="g">x</FormGrid>);
    const g = screen.getByTestId("g");
    expect(isInUiLayer(g)).toBe(true);
    expect(styleOf(g).display).toBe("grid");
    expect(styleOf(g)["grid-template-columns"]).toBe("minmax(0, 1fr)");
    expect(styleOf(g).gap).toBe("var(--space-4)");
  });

  it("is two columns from sm up by default", () => {
    render(<FormGrid data-testid="g">x</FormGrid>);
    expect(styleOf(screen.getByTestId("g"), { media: "(min-width: 640px)" })["grid-template-columns"]).toBe(
      "repeat(2, minmax(0, 1fr))",
    );
  });

  it("takes three columns, or stays at one", () => {
    const { rerender } = render(<FormGrid data-testid="g" columns={3}>x</FormGrid>);
    expect(styleOf(screen.getByTestId("g"), { media: "(min-width: 640px)" })["grid-template-columns"]).toBe(
      "repeat(3, minmax(0, 1fr))",
    );
    rerender(<FormGrid data-testid="g" columns={1}>x</FormGrid>);
    expect(styleOf(screen.getByTestId("g"), { media: "(min-width: 640px)" })["grid-template-columns"]).toBeUndefined();
  });

  it("passes a caller's className through", () => {
    render(<FormGrid data-testid="g" className="mt-4">x</FormGrid>);
    expect(screen.getByTestId("g")).toHaveClass("mt-4");
  });
});
