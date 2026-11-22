// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Label } from "@ui/components/label";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("Label", () => {
  it("is a real <label> that names its field through htmlFor", () => {
    render(
      <>
        <Label htmlFor="n">Name</Label>
        <input id="n" />
      </>,
    );
    expect(screen.getByText("Name").tagName).toBe("LABEL");
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("stops a double-click from selecting the label text", () => {
    render(<Label>Name</Label>);
    const notPrevented = fireEvent.mouseDown(screen.getByText("Name"), { detail: 2 });
    expect(notPrevented).toBe(false);
  });

  it("lets an ordinary click through", () => {
    render(<Label>Name</Label>);
    expect(fireEvent.mouseDown(screen.getByText("Name"), { detail: 1 })).toBe(true);
  });

  it("is 14px medium text with a tight line", () => {
    render(<Label>Name</Label>);
    const label = screen.getByText("Name");
    expect(isInUiLayer(label)).toBe(true);
    const css = styleOf(label);
    expect(css["font-size"]).toBe("0.875rem");
    expect(css["font-weight"]).toBe("500");
    expect(css["line-height"]).toBe("1");
  });

  it("keeps a caller's className", () => {
    render(<Label className="mb-2">Name</Label>);
    expect(screen.getByText("Name")).toHaveClass("mb-2");
  });
});
