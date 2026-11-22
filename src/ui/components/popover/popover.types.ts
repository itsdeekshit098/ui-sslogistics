import type { HTMLAttributes, ReactNode } from "react";
import type { Placement } from "../../hooks/usePopoverPosition";

export interface PopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element the popup is attached to (usually the button that opened it). */
  anchor: HTMLElement | null;
  placement?: Placement;
  /** Match the anchor's width instead of sizing to the content. */
  matchAnchorWidth?: boolean;
  /** Width in px when `matchAnchorWidth` is off, used to keep it on screen. */
  width?: number;
  /** ARIA role of the popup. Default "dialog"; use "presentation" when the content carries its own role (a menu, say). */
  role?: "dialog" | "listbox" | "grid" | "presentation";
  children: ReactNode;
}
