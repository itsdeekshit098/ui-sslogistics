"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Bar, Rail, Shimmer } from "./navigationProgress.styles";
import type { NavigationProgressState } from "./navigationProgress.types";

/**
 * A lightweight top navigation progress bar.
 * Fires automatically on every client-side route change in the Next.js App Router.
 * Zero external dependencies.
 */
/** The bar gives up after this long, so a navigation that never changes the path can't leave it crawling. */
const MAX_DURATION_MS = 10_000;

export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<NavigationProgressState>({
    progress: 0,
    visible: false,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPathnameRef = useRef(pathname);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Never leave an interval running after the bar is gone.
  useEffect(() => clearTimer, [clearTimer]);

  const startProgress = useCallback(() => {
    // A second click while the bar is crawling restarts it; the first interval must stop.
    clearTimer();
    setState({ visible: true, progress: 10 });

    // Simulate non-linear crawl towards 90% — never reaches 100% until done
    let current = 10;
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      if (Date.now() - startedAt > MAX_DURATION_MS) {
        clearTimer();
        setState({ visible: false, progress: 0 });
        return;
      }
      const remaining = 90 - current;
      const increment = Math.max(1, remaining * 0.08);
      current = Math.min(89, current + increment);
      setState((prev) => ({ ...prev, progress: current }));
    }, 120);
  }, [clearTimer]);

  const completeProgress = useCallback(() => {
    clearTimer();
    setState((prev) => ({ ...prev, progress: 100 }));
    // Fade out after bar reaches 100%
    const timeout = setTimeout(() => {
      setState({ visible: false, progress: 0 });
    }, 400);
    return () => clearTimeout(timeout);
  }, [clearTimer]);

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

      if (!isInternal || isHashLink) return;

      // The bar finishes when the pathname changes. A link that only changes the
      // query string (/vehicles → /vehicles?fcStatus=…) keeps the same pathname,
      // so it would never finish; those are filters on the page, not navigations.
      let destination: URL;
      try {
        destination = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (destination.pathname !== pathname) startProgress();
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, startProgress]);

  return (
    <Rail data-ui="navigation-progress" aria-hidden="true" $visible={state.visible}>
      <Bar $progress={state.progress} $done={state.progress === 100}>
        <Shimmer $done={state.progress >= 100} />
      </Bar>
    </Rail>
  );
}
