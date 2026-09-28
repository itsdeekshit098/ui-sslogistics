"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { BottomSheetProps } from "./bottomSheet.types";

/**
 * Panel that slides up from the bottom edge — the phone-native replacement
 * for a centered dialog. Sits below --z-modal-overlay (50) so a confirm
 * Modal opened from inside it (e.g. sign-out) stacks on top.
 */
export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Move focus into the sheet while it's open (so keyboard and screen-reader
  // users land in it rather than on the page behind), and hand it back to
  // whatever opened it — the "⋯" or "More" button — on close.
  useEffect(() => {
    if (!open || !mounted) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => opener?.focus?.({ preventScroll: true });
  }, [open, mounted]);

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[var(--overlay-background)] backdrop-blur-[2px] animate-in fade-in-0 duration-200"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[41] flex max-h-[92dvh] flex-col outline-none rounded-t-2xl border-t border-border bg-card text-card-foreground shadow-[0_-12px_40px_rgba(0,0,0,0.18)]",
          "pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom duration-300",
          className,
        )}
      >
        <div className="flex justify-center pt-2.5 pb-1" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 pb-2">
          <div id={titleId} className="min-w-0 text-base font-semibold">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 scrollbar-custom">
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
