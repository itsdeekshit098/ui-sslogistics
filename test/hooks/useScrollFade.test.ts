// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScrollFade, revealHorizontally } from "@/hooks/useScrollFade";

class FakeResizeObserver {
  cb: () => void;
  constructor(cb: () => void) {
    this.cb = cb;
  }
  observe() {
    this.cb();
  }
  disconnect() {}
}

describe("useScrollFade", () => {
  it("has no fade style before an element is attached", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const { result } = renderHook(() => useScrollFade());
    expect(result.current.style).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("computes left/right fade once attached to a scrollable element", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const { result } = renderHook(() => useScrollFade());

    const el = document.createElement("div");
    Object.defineProperties(el, {
      scrollLeft: { value: 10, writable: true },
      clientWidth: { value: 100, writable: true },
      scrollWidth: { value: 500, writable: true },
    });

    act(() => result.current.ref(el));

    expect(result.current.style).toBeDefined();
    expect(result.current.style?.maskImage).toContain("linear-gradient");
    vi.unstubAllGlobals();
  });

  it("refresh() is a no-op when no element is attached", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const { result } = renderHook(() => useScrollFade());
    expect(() => act(() => result.current.refresh())).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("revealHorizontally", () => {
  it("does nothing when scroller or child is null", () => {
    expect(() => revealHorizontally(null, null)).not.toThrow();
  });

  it("scrolls left when the child is to the left of the visible area", () => {
    const scroller = document.createElement("div");
    scroller.scrollLeft = 100;
    scroller.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;
    Object.defineProperty(scroller, "clientWidth", { value: 200 });

    const child = document.createElement("div");
    child.getBoundingClientRect = () => ({ left: -50, width: 20 }) as DOMRect;

    revealHorizontally(scroller, child);

    expect(scroller.scrollLeft).toBeLessThan(100);
  });

  it("scrolls right when the child is past the visible area", () => {
    const scroller = document.createElement("div");
    scroller.scrollLeft = 0;
    scroller.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;
    Object.defineProperty(scroller, "clientWidth", { value: 100 });

    const child = document.createElement("div");
    child.getBoundingClientRect = () => ({ left: 300, width: 20 }) as DOMRect;

    revealHorizontally(scroller, child);

    expect(scroller.scrollLeft).toBeGreaterThan(0);
  });
});
