"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import { usePopoverPosition } from "../../hooks/usePopoverPosition";
import { Surface } from "./popover.styles";
import type { PopoverProps } from "./popover.types";

/**
 * A floating panel attached to an element: positioned beside it, flipped when
 * there is no room, closed by Escape or a click outside (focus returns to the
 * anchor). It owns no trigger; the caller keeps the `open` state, so a button,
 * a field or a keyboard shortcut can all open it.
 */
export function Popover({
  open,
  onOpenChange,
  anchor,
  placement = "bottom-start",
  matchAnchorWidth = false,
  width,
  role = "dialog",
  children,
  ...props
}: PopoverProps) {
  const surface = useRef<HTMLDivElement>(null);

  const position = usePopoverPosition(anchor, open, placement, matchAnchorWidth ? 0 : width);

  const close = () => {
    onOpenChange(false);
    anchor?.focus?.({ preventScroll: true });
  };

  useEscapeKey(close, open);
  // Clicking the anchor itself is the anchor's business (it toggles), not an outside click.
  useOutsideClick([surface, { current: anchor }], () => onOpenChange(false), open);

  if (!open || !position || typeof document === "undefined") return null;

  return createPortal(
    <Surface
      data-ui="popover"
      {...props}
      ref={surface}
      role={role}
      tabIndex={-1}
      $position={position}
      $matchWidth={matchAnchorWidth}
      $width={width}
    >
      {children}
    </Surface>,
    document.body,
  );
}
