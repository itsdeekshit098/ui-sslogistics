"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { revealHorizontally, useScrollFade } from "../../hooks/useScrollFade";
import { Badge, Tab, Track } from "./tabs.styles";
import type { TabsProps } from "./tabs.types";

/**
 * Tab bar, drawn as the same grey track with a raised active button as
 * <SegmentedControl> so every "pick one" control in the app shares a shape.
 * It differs in behaviour, not looks: this switches between panels. Follows
 * the WAI-ARIA tabs pattern with manual
 * activation: arrows move focus, Enter/Space selects — so keyboard users
 * aren't forced through every panel's data fetch on their way to the one
 * they want.
 *
 * Renders only the tab strip; the caller renders the active panel and should
 * give it `role="tabpanel"` plus `id={`${idPrefix}-panel-${value}`}`.
 */
export function Tabs({ items, value, onValueChange, className, idPrefix = "tabs" }: TabsProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const { ref: listRef, el: listEl, edges, refresh: refreshFade } = useScrollFade();

  // On a phone the strip overflows; keep the selected tab in view (e.g. one
  // chosen by arrow key, or restored from state) instead of off the edge.
  useEffect(() => {
    revealHorizontally(listEl, tabRefs.current[value] ?? null);
    refreshFade();
  }, [value, listEl, refreshFade]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const enabled = items.filter((item) => !item.disabled);
      if (enabled.length === 0) return;

      const currentEnabledIndex = enabled.findIndex((item) => item.key === items[index].key);

      let nextKey: string | null = null;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextKey = enabled[(currentEnabledIndex + 1) % enabled.length].key;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextKey = enabled[(currentEnabledIndex - 1 + enabled.length) % enabled.length].key;
          break;
        case "Home":
          nextKey = enabled[0].key;
          break;
        case "End":
          nextKey = enabled[enabled.length - 1].key;
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          onValueChange(items[index].key);
          return;
        default:
          return;
      }

      event.preventDefault();
      tabRefs.current[nextKey]?.focus();
    },
    [items, onValueChange],
  );

  return (
    <Track
      data-ui="tabs"
      ref={listRef}
      role="tablist"
      aria-orientation="horizontal"
      className={className}
      $fadeLeft={edges.left}
      $fadeRight={edges.right}
    >
      {items.map((item, index) => {
        const isActive = item.key === value;

        return (
          <Tab
            key={item.key}
            ref={(node) => {
              tabRefs.current[item.key] = node;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.key}`}
            aria-selected={isActive}
            aria-controls={`${idPrefix}-panel-${item.key}`}
            // Only the active tab is in the tab order; arrows move within the
            // strip, so Tab jumps straight past it to the panel content.
            tabIndex={isActive ? 0 : -1}
            disabled={item.disabled}
            onClick={() => !item.disabled && onValueChange(item.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            $active={isActive}
            $disabled={!!item.disabled}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge != null && <Badge $active={isActive}>{item.badge}</Badge>}
          </Tab>
        );
      })}
    </Track>
  );
}
