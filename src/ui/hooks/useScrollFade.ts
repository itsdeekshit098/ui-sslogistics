import { useCallback, useEffect, useState } from "react";

/**
 * Fades whichever edge of a horizontal scroller still has content past it,
 * so a clipped tab or chip reads as "more this way" rather than as a label
 * cut off by mistake. Attach `ref` to the scroller (a callback ref, so it
 * also works for a strip that mounts later); `refresh` is for callers that
 * move the scroll position themselves.
 *
 * It reports which `edges` have more to scroll to; the component draws the
 * fade itself (see `edgeFade` in the tabs styles), so no inline style is needed.
 */
export function useScrollFade() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const refresh = useCallback(() => {
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, [el]);

  useEffect(() => {
    if (!el) return;
    // ResizeObserver reports once on observe(), which sets the first state.
    el.addEventListener("scroll", refresh, { passive: true });
    const ro = new ResizeObserver(refresh);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", refresh);
      ro.disconnect();
    };
  }, [el, refresh]);

  return { ref: setEl, el, edges, refresh };
}

/** Scrolls a horizontal scroller just enough to show `child` — unlike
 * scrollIntoView, which would also scroll the page vertically to reach a
 * strip that's below the fold. */
export function revealHorizontally(scroller: HTMLElement | null, child: HTMLElement | null) {
  if (!scroller || !child) return;
  const pad = 24;
  const box = scroller.getBoundingClientRect();
  const rect = child.getBoundingClientRect();
  const left = rect.left - box.left + scroller.scrollLeft;
  const right = left + rect.width;
  if (left - pad < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, left - pad);
  else if (right + pad > scroller.scrollLeft + scroller.clientWidth)
    scroller.scrollLeft = right + pad - scroller.clientWidth;
}
