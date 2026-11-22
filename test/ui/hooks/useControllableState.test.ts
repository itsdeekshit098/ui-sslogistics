// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useControllableState } from "@ui/hooks/useControllableState";

describe("useControllableState", () => {
  it("uncontrolled: starts at defaultValue, updates itself and reports the change", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ value: undefined, defaultValue: 1, onChange }),
    );
    expect(result.current[0]).toBe(1);
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("controlled: shows the parent's value and only reports, never updates itself", () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useControllableState({ value, defaultValue: 0, onChange }),
      { initialProps: { value: 5 } },
    );
    act(() => result.current[1](9));
    expect(onChange).toHaveBeenCalledWith(9);
    expect(result.current[0]).toBe(5); // the parent hasn't changed it
    rerender({ value: 9 });
    expect(result.current[0]).toBe(9);
  });

  it("does not report a change to the same value", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ value: undefined, defaultValue: "a", onChange }),
    );
    act(() => result.current[1]("a"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts an updater function", () => {
    const { result } = renderHook(() =>
      useControllableState({ value: undefined, defaultValue: 1 }),
    );
    act(() => result.current[1]((n) => n + 1));
    expect(result.current[0]).toBe(2);
  });

  it("treats a controlled false/0/empty value as controlled", () => {
    const { result } = renderHook(() =>
      useControllableState({ value: false, defaultValue: true }),
    );
    expect(result.current[0]).toBe(false);
  });

  it("keeps a stable setter between renders", () => {
    const { result, rerender } = renderHook(() =>
      useControllableState({ value: undefined, defaultValue: 0 }),
    );
    const first = result.current[1];
    rerender();
    expect(result.current[1]).toBe(first);
  });

  it("warns in development when a field switches between controlled and uncontrolled", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rerender } = renderHook(
      ({ value }: { value: number | undefined }) =>
        useControllableState({ value, defaultValue: 0 }),
      { initialProps: { value: undefined as number | undefined } },
    );
    expect(warn).not.toHaveBeenCalled();
    rerender({ value: 3 });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
