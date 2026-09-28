"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import type { FilterDrawerProps } from "./filterDrawer.types";
import * as styles from "./filterDrawer.style";

export function FilterDrawer({
  open,
  onClose,
  onApply,
  children,
  title = "Filters",
}: FilterDrawerProps) {
  const [mounted, setMounted] = useState(false);

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

  if (!open || !mounted || typeof document === "undefined") return null;

  const drawerContent = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={styles.backdrop}
        className="animate-in fade-in duration-200"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={styles.panel}
        className="ss-filter-panel animate-in slide-in-from-right duration-300 max-md:slide-in-from-bottom"
      >
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8 md:w-8"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Body — render filter fields as children */}
        <div style={styles.body} className="scrollbar-custom">
          {children}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Close
          </Button>
          <Button onClick={onApply} className="flex-1">
            Apply Filters
          </Button>
        </div>
      </div>
    </>
  );

  return createPortal(drawerContent, document.body);
}
