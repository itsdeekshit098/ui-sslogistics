// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useIdleTimeout", () => {
  it("calls onTimeout after idleMs of no activity", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ idleMs: 1000, onTimeout }));

    vi.advanceTimersByTime(999);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("resets the timer on activity past the throttle window", () => {
    const onTimeout = vi.fn();
    // idleMs comfortably longer than THROTTLE_MS (30s) so an activity event
    // fired after the throttle window can still land before the original
    // deadline and prove it reset the timer.
    renderHook(() => useIdleTimeout({ idleMs: 60_000, onTimeout }));

    vi.advanceTimersByTime(30_001);
    document.dispatchEvent(new Event("mousemove"));
    // Without the reset, the original deadline (60_000 from mount) would
    // land here; with the reset, the new deadline is 30_001 + 60_000.
    vi.advanceTimersByTime(29_999);

    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("ignores activity within the throttle window", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ idleMs: 1000, onTimeout }));

    document.dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(900);
    // Within THROTTLE_MS (30s) of the first activity timestamp (0), so this
    // does not reset the idle timer.
    document.dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(200);

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("clears listeners and the timer on unmount", () => {
    const onTimeout = vi.fn();
    const { unmount } = renderHook(() => useIdleTimeout({ idleMs: 1000, onTimeout }));

    unmount();
    vi.advanceTimersByTime(2000);

    expect(onTimeout).not.toHaveBeenCalled();
  });
});
