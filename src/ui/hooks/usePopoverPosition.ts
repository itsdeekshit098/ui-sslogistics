import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

export interface PopoverPosition {
  left: number;
  /** Open downward: distance from the viewport top. */
  top?: number;
  /** Open upward: distance from the viewport bottom. */
  bottom?: number;
  /** Room available on the chosen side. */
  maxHeight: number;
  /** The anchor's width, for a popup that should match it. */
  anchorWidth: number;
  side: "top" | "bottom";
}

const GAP = 6;
const MARGIN = 8;
const MIN_ROOM = 160;

/**
 * Where to put a popup relative to the element that opened it: below by
 * default, flipping above when there is less than ~160px below and more above.
 * Measured against the visual viewport, so the on-screen keyboard is respected.
 * Recomputed on scroll and resize while open.
 */
export function usePopoverPosition(
  anchor: HTMLElement | null,
  open: boolean,
  placement: Placement = "bottom-start",
  popupWidth = 0,
): PopoverPosition | null {
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const measure = useCallback(() => {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const vv = window.visualViewport;
    const visibleTop = vv?.offsetTop ?? 0;
    const visibleBottom = visibleTop + (vv?.height ?? window.innerHeight);
    const visibleWidth = vv?.width ?? window.innerWidth;
    const below = visibleBottom - rect.bottom - MARGIN;
    const above = rect.top - visibleTop - MARGIN;
    const preferUp = placement.startsWith("top");
    const goUp = preferUp ? !(above < MIN_ROOM && below > above) : below < MIN_ROOM && above > below;

    let left = placement.endsWith("end") ? rect.right - popupWidth : rect.left;
    if (popupWidth) left = Math.min(Math.max(left, MARGIN), Math.max(visibleWidth - popupWidth - MARGIN, MARGIN));

    setPosition({
      left,
      anchorWidth: rect.width,
      side: goUp ? "top" : "bottom",
      ...(goUp
        ? {
            bottom: document.documentElement.clientHeight - rect.top + GAP,
            maxHeight: Math.max(above - GAP, 120),
          }
        : { top: rect.bottom + GAP, maxHeight: Math.max(below - GAP, 120) }),
    });
  }, [anchor, placement, popupWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", measure, { passive: true, capture: true });
    window.addEventListener("resize", measure, { passive: true });
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  return open ? position : null;
}
