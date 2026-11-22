// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { Tooltip } from "@ui/components/tooltip";
import { styleOf, isInUiLayer } from "@test/uiStyles";

class FakeResizeObserver {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function show() {
  render(
    <Tooltip content="Why not" delay={0}>
      <button>trigger</button>
    </Tooltip>,
  );
  fireEvent.mouseEnter(screen.getByText("trigger").parentElement!);
  act(() => {
    vi.advanceTimersByTime(1);
  });
}

describe("Tooltip styles", () => {
  it("wraps its trigger in an inline-flex box", () => {
    render(
      <Tooltip content="x">
        <button>trigger</button>
      </Tooltip>,
    );
    const wrapper = screen.getByText("trigger").parentElement!;
    expect(isInUiLayer(wrapper)).toBe(true);
    expect(styleOf(wrapper).display).toBe("inline-flex");
  });

  it("is a dark bubble above the page, positioned through custom properties only", () => {
    show();
    const bubble = document.querySelector('[data-ui="tooltip"]') as HTMLElement;
    expect(bubble).not.toBeNull();
    const css = styleOf(bubble);
    expect(css.position).toBe("fixed");
    expect(css["z-index"]).toBe("var(--z-popover)");
    expect(css["background-color"]).toBe("var(--foreground)");
    expect(css["pointer-events"]).toBe("none");
    // The only inline style is the position, as custom properties.
    expect(bubble.getAttribute("style")).toMatch(/--tip-top/);
    expect(bubble.getAttribute("style")).not.toMatch(/(^|;)\s*(top|left|opacity)\s*:/);
  });

  it("stays hidden until it has been measured and positioned", () => {
    show();
    const bubble = document.querySelector('[data-ui="tooltip"]') as HTMLElement;
    // jsdom reports zero-size boxes, so it never reaches the positioned state.
    expect(styleOf(bubble).visibility).toBe("hidden");
    expect(styleOf(bubble).opacity).toBe("0");
  });
});
