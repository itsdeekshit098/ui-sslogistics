// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Textarea } from "@ui/components/textarea";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("Textarea", () => {
  it("renders a textarea that takes a value and a ref", () => {
    render(<Textarea aria-label="notes" defaultValue="hi" />);
    expect((screen.getByLabelText("notes") as HTMLTextAreaElement).value).toBe("hi");
  });

  it("shares the input's field look and is at least 80px tall", () => {
    render(<Textarea aria-label="notes" />);
    const el = screen.getByLabelText("notes");
    expect(isInUiLayer(el)).toBe(true);
    const css = styleOf(el);
    expect(css["min-height"]).toBe("80px");
    expect(css["border-color"]).toBe("var(--input)");
    expect(css["font-size"]).toBe("1rem");
  });

  it("drops to 14px type on desktop", () => {
    render(<Textarea aria-label="notes" />);
    expect(styleOf(screen.getByLabelText("notes"), { media: "(min-width: 768px)" })["font-size"]).toBe("0.875rem");
  });
});
