"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
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
      const timeoutId = setTimeout(() => {
        completeProgress();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [pathname, completeProgress]);

  // Listen for link clicks to start the bar proactively
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Don't trigger for download links, external targets, or explicitly opted-out links
      if (
        target.hasAttribute("download") ||
        target.getAttribute("target") === "_blank" ||
        target.hasAttribute("data-no-progress")
      ) {
        return;
      }

      // Only trigger for internal same-origin navigations
      const isInternal =
        !href.startsWith("http") &&
        !href.startsWith("//") &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:");

      // Don't trigger for hash links on the same page
      const isHashLink =
        href.startsWith("#") ||
        href.startsWith(`${pathname}#`) ||
        (pathname === "/" && href.startsWith("/#"));

      if (isInternal && !isHashLink && href !== pathname) {
        startProgress();
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, startProgress]);

  return (
    // Outer rail: fixed to top edge, full width, 2px tall, above everything
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        zIndex: 9999,
        pointerEvents: "none",
        opacity: state.visible ? 1 : 0,
        transition: "opacity 0.35s ease",
      }}
    >
      {/* Inner bar: sleek gradient with leading-edge glow */}
      <div
        style={{
          position: "relative", // Required so shimmer (position: absolute) anchors to this bar's right edge
          height: "100%",
          width: `${state.progress}%`,
          borderRadius: "0 1px 1px 0",
          background: "linear-gradient(90deg, #6366f1 0%, #818cf8 40%, #a78bfa 70%, #c084fc 100%)",
          boxShadow: "0 0 8px rgba(99, 102, 241, 0.5), 0 0 3px rgba(99, 102, 241, 0.3)",
          transition: state.progress === 100
            ? "width 0.15s ease-out"
            : "width 120ms ease-in-out",
        }}
      >
        {/* Leading bright dot — visible shimmer at the bar's tip */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "-1px",
            width: "80px",
            height: "4px",
            borderRadius: "0 2px 2px 0",
            background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6))",
            opacity: state.progress < 100 ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
        />
      </div>
    </div>
  );
}
