// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/select";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

// Radix Select leans on a few browser APIs jsdom lacks.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function ui(extra: { disabled?: boolean } = {}) {
  return (
    <Select defaultValue="b" {...extra}>
      <SelectTrigger aria-label="Pick">
        <SelectValue placeholder="Choose" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Alpha</SelectItem>
        <SelectItem value="b">Beta</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("Select", () => {
  it("shows the chosen value on a full-width trigger", () => {
    render(ui());
    const trigger = screen.getByRole("combobox", { name: "Pick" });
    expect(trigger).toHaveTextContent("Beta");
    expect(isInUiLayer(trigger)).toBe(true);
    expect(styleOf(trigger).width).toBe("100%");
    expect(trigger.getAttribute("style")).toBeNull();
  });

  it("is a 40px bordered field with the input tokens", () => {
    render(ui());
    const css = styleOf(screen.getByRole("combobox"));
    expect(css.height).toBe("var(--input-height)");
    expect(css["border-color"]).toBe("var(--input)");
    expect(css["border-radius"]).toBe("var(--input-radius)");
    expect(css["background-color"]).toBe("var(--background)");
  });

  it("drops to 14px type on desktop, dims when disabled and shows the open state", () => {
    render(ui());
    const trigger = screen.getByRole("combobox");
    expect(styleOf(trigger, { media: "(min-width: 768px)" })["font-size"]).toBe("0.875rem");
    expect(styleOf(trigger, { state: ":disabled" }).opacity).toBe("50%");
    expect(styleOf(trigger, { state: '[data-state="open"]' })["border-color"]).toBe("var(--border)");
  });

  it("styles a placeholder in the placeholder colour", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Pick">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox");
    expect(styleOf(trigger, { state: "[data-placeholder]" }).color).toBe("var(--placeholder-foreground)");
  });
});
