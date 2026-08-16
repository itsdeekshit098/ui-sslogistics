"use client";

import React from "react";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { cn } from "@/lib/utils";
import type { BusyOverlayProps } from "./busyOverlay.types";

/**
 * Keeps content on screen while it is being refetched, dimmed and behind a
 * spinner.
 *
 * This exists for the moment after a save: the record is written and the modal
 * has closed, but the page behind it is still a request away. Without it the
 * page sits on stale figures with nothing happening, and the new row appears
 * out of nowhere a second later. This is deliberately different from a list
 * page's <DataTable loading> skeleton: on a list, each fetch can be a wholly
 * different set of rows (new filter, new page), so blanking to skeleton and
 * rebuilding is correct. On a detail page, a refetch after a mutation is
 * still the same record — flashing the whole table to skeleton bars would
 * lose scroll position and overstate what actually changed, so it stays on
 * screen, dimmed, and updates in place. Covers detail-page tables (including
 * ones rendered through <DataTable>, which is why their `loading` prop is
 * left unset there) and card grids alike.
 */
export const BusyOverlay: React.FC<BusyOverlayProps> = ({
  busy,
  label = "Updating…",
  children,
  className,
}) => (
  <div className={cn("relative", className)}>
    <div
      aria-busy={busy}
      className={cn(
        "transition-opacity duration-200",
        busy && "pointer-events-none select-none opacity-40",
      )}
    >
      {children}
    </div>

    {busy && (
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-12"
      >
        <span className="sticky top-1/2 flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
          <LoadingSpinner size="sm" />
          {label}
        </span>
      </div>
    )}
  </div>
);

export default BusyOverlay;
