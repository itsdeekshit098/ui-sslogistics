// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useResolvedTheme, useIsDarkMode } from "@/hooks/useResolvedTheme";

describe("useResolvedTheme", () => {
  it("returns light when the root has no dark class", async () => {
    document.documentElement.classList.remove("dark");
    const { result } = renderHook(() => useResolvedTheme());
    await waitFor(() => expect(result.current).toBe("light"));
  });

  it("returns dark when the root has the dark class", async () => {
    document.documentElement.classList.add("dark");
    const { result } = renderHook(() => useResolvedTheme());
    await waitFor(() => expect(result.current).toBe("dark"));
    document.documentElement.classList.remove("dark");
  });

  it("reacts to the root class changing after mount", async () => {
    document.documentElement.classList.remove("dark");
    const { result } = renderHook(() => useResolvedTheme());
    await waitFor(() => expect(result.current).toBe("light"));

    act(() => document.documentElement.classList.add("dark"));

    await waitFor(() => expect(result.current).toBe("dark"));
    document.documentElement.classList.remove("dark");
  });
});

describe("useIsDarkMode", () => {
  it("mirrors useResolvedTheme as a boolean", async () => {
    document.documentElement.classList.add("dark");
    const { result } = renderHook(() => useIsDarkMode());
    await waitFor(() => expect(result.current).toBe(true));
    document.documentElement.classList.remove("dark");
  });
});
