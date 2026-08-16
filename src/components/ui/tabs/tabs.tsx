"use client";

import React, { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import type { TabsProps } from "./tabs.types";

/**
 * Underlined tab bar. Follows the WAI-ARIA tabs pattern with manual
 * activation: arrows move focus, Enter/Space selects — so keyboard users
 * aren't forced through every panel's data fetch on their way to the one
 * they want.
 *
 * Renders only the tab strip; the caller renders the active panel and should
 * give it `role="tabpanel"` plus `id={`${idPrefix}-panel-${value}`}`.
 */
const Tabs: React.FC<TabsProps> = ({
  items,
  value,
  onValueChange,
  className,
  idPrefix = "tabs",
}) => {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const enabled = items.filter((item) => !item.disabled);
      if (enabled.length === 0) return;

      const currentEnabledIndex = enabled.findIndex(
        (item) => item.key === items[index].key,
      );

      let nextKey: string | null = null;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextKey = enabled[(currentEnabledIndex + 1) % enabled.length].key;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextKey =
            enabled[(currentEnabledIndex - 1 + enabled.length) % enabled.length].key;
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
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "flex items-center gap-6 overflow-x-auto border-b border-border",
        className,
      )}
    >
      {items.map((item, index) => {
        const isActive = item.key === value;

        return (
          <button
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
            className={cn(
              "relative flex shrink-0 items-center gap-2 border-b-2 px-1 pb-3 pt-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-sm",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
              item.disabled && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge != null && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export { Tabs };
export default Tabs;
