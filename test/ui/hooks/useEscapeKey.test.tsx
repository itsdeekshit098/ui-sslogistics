// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { fireEvent, renderHook } from "@testing-library/react";
import { useEscapeKey } from "@ui/hooks/useEscapeKey";

describe("useEscapeKey", () => {
  it("lets only the layer opened last act, then the one beneath it", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const a = renderHook(({ fn }) => useEscapeKey(fn), { initialProps: { fn: outer } });
    const b = renderHook(() => useEscapeKey(inner));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();

    b.unmount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(outer).toHaveBeenCalledOnce();
    a.unmount();
  });

  it("keeps its place when its callback changes on every render", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const a = renderHook(({ fn }) => useEscapeKey(fn), { initialProps: { fn: () => outer() } });
    const b = renderHook(() => useEscapeKey(inner));
    a.rerender({ fn: () => outer() });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
    a.unmount();
    b.unmount();
  });

  it("does nothing while disabled, and ignores other keys", () => {
    const fn = vi.fn();
    const h = renderHook(() => useEscapeKey(fn, false));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(fn).not.toHaveBeenCalled();
    h.unmount();
    const on = renderHook(() => useEscapeKey(fn));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(fn).not.toHaveBeenCalled();
    on.unmount();
  });
});
