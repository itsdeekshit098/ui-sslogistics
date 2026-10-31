"use client";

import React, { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import type { SegmentedControlProps } from "./segmentedControl.types";

/**
 * A single-select filter group (All / Active / Closed, …) — visually
 * distinct from action buttons on purpose. The list pages used to render
 * these as <Button variant="default"> when active, which put a filter
 * chip at the same visual weight as "New Loan," the actual primary action
 * on the page. `role="radiogroup"` because this narrows a list rather than
 * switching between separate panels (that's what Tabs is for).
 */
export function SegmentedControl({
  items,
  value,
  onValueChange,
  className,
  idPrefix = "segmented",
  disabled = false,
}: SegmentedControlProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex: number | null = null;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = (index + 1) % items.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex = (index - 1 + items.length) % items.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = items.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      const next = items[nextIndex];
      onValueChange(next.key);
      refs.current[next.key]?.focus();
    },
    [items, onValueChange],
  );

  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex items-center gap-1 rounded-xl bg-muted p-1 max-md:gap-2 max-md:rounded-none max-md:bg-transparent max-md:p-0",
        className,
      )}
    >
      {items.map((item, index) => {
        const isActive = item.key === value;
        return (
          <button
            key={item.key}
            ref={(node) => {
              refs.current[item.key] = node;
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            id={`${idPrefix}-${item.key}`}
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            onClick={() => onValueChange(item.key)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xs px-3 py-1.5 text-sm font-medium transition-colors max-md:rounded-[10px] max-md:border max-md:px-3.5 max-md:py-[9px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted",
              "disabled:cursor-not-allowed disabled:opacity-60",
              isActive
                ? "bg-card text-foreground shadow-xs max-md:border-primary max-md:bg-primary max-md:font-bold max-md:text-white max-md:shadow-none"
                : "text-muted-foreground enabled:hover:text-foreground max-md:border-border max-md:font-semibold",
            )}
          >
            {item.label}
            {item.count != null && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isActive ? "text-muted-foreground max-md:text-white/80" : "text-muted-foreground/70",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
