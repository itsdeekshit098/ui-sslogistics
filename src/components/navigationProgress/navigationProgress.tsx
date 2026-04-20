"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavigationProgressState } from "./navigationProgress.types";

/**
 * A lightweight top navigation progress bar.
 * Fires automatically on every client-side route change in the Next.js App Router.
 * Zero external dependencies.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<NavigationProgressState>({
    progress: 0,
    visible: false,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPathnameRef = useRef(pathname);

  const startProgress = useCallback(() => {
    setState({ visible: true, progress: 10 });

    // Simulate non-linear crawl towards 90% — never reaches 100% until done
    let current = 10;
    timerRef.current = setInterval(() => {
      const remaining = 90 - current;
      const increment = Math.max(1, remaining * 0.08);
      current = Math.min(89, current + increment);
      setState((prev) => ({ ...prev, progress: current }));
    }, 120);
  }, []);

  const completeProgress = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState((prev) => ({ ...prev, progress: 100 }));
    // Fade out after bar reaches 100%
    const timeout = setTimeout(() => {
      setState({ visible: false, progress: 0 });
    }, 400);
    return () => clearTimeout(timeout);
  }, []);

  // Detect route changes (pathname change = navigation completed)
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      completeProgress();
    }
  }, [pathname, completeProgress]);

  // Listen for link clicks to start the bar proactively
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Only trigger for internal same-origin navigations
      const isInternal =
        !href.startsWith("http") &&
        !href.startsWith("//") &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:");

      if (isInternal && href !== pathname) {
        startProgress();
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, startProgress]);

  if (!state.visible) return null;

  return (
    // Outer rail: fixed to top edge, full width, 3px tall, above everything
    <div className="fixed top-0 left-0 right-0 h-[3px] z-[9999] pointer-events-none">
      {/* Inner bar: only width is truly dynamic and must stay as inline style */}
      <div
        className={cn(
          "h-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-r-sm shadow-[0_0_10px_rgba(79,70,229,0.6)]",
          state.progress === 100
            ? "transition-[width] duration-150 ease-out"
            : "transition-[width] duration-[120ms] ease-in-out"
        )}
        style={{ width: `${state.progress}%` }}
      />
    </div>
  );
}
