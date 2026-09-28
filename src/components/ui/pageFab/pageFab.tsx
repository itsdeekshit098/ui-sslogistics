"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PlusIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { PageFabProps } from "./pageFab.types";

/**
 * The page's main "create" action as a floating round "+" above the bottom
 * nav, phone widths only. Always on screen — it used to slide away on
 * scroll-down, which read as the button disappearing just when needed.
 * Icon-only to keep content visible beneath it; the label stays as the
 * accessible name (and title) for screen readers. Hidden (via globals.css)
 * while an empty state with its own call to action is on screen.
 */
export function PageFab({ label, onClick, icon, disabled, disabledReason, testId }: PageFabProps) {
  const [showReason, setShowReason] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showReason) return;
    const t = setTimeout(() => setShowReason(false), 3500);
    return () => clearTimeout(t);
  }, [showReason]);

  // With a reason to explain, the button stays tappable (aria-disabled) so
  // the tap can reveal it; without one it is simply disabled.
  const explainable = disabled && !!disabledReason;

  // Portalled to <body>: pages wrap their content in `animate-in`, and a
  // transformed ancestor turns `position: fixed` into "fixed to that
  // container" — the button then drifted with the page instead of sitting
  // above the bottom nav.
  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "ss-fab fixed right-2 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-20 flex flex-col items-end gap-2 md:hidden",
      )}
    >
      {showReason && disabledReason && (
        <div
          role="status"
          className="max-w-[16rem] rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-lg animate-in fade-in-0 slide-in-from-bottom-2"
        >
          {disabledReason}
        </div>
      )}
      <button
        type="button"
        data-testid={testId}
        onClick={() => (disabled ? explainable && setShowReason(true) : onClick())}
        disabled={disabled && !explainable}
        aria-disabled={disabled || undefined}
        aria-label={label}
        title={label}
        className={cn(
          "flex h-13 w-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_16px_-4px_rgba(37,99,235,0.5),0_2px_4px_rgba(0,0,0,0.12)] transition-transform active:scale-95",
          disabled && "opacity-60 shadow-none",
        )}
      >
        {icon ?? <PlusIcon size={24} />}
      </button>
    </div>,
    document.body,
  );
}
