"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";
import { Count, Segment, Track } from "./segmentedControl.styles";
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
    (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
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
    <Track data-ui="segmented-control" role="radiogroup" className={className}>
      {items.map((item, index) => {
        const isActive = item.key === value;
        return (
          <Segment
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
            $active={isActive}
          >
            {item.label}
            {item.count != null && <Count $active={isActive}>{item.count}</Count>}
          </Segment>
        );
      })}
    </Track>
  );
}
