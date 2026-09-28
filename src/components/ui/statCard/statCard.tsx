"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { StatCardProps, StatCardTone } from "./statCard.types";

const TONE_STYLES: Record<
  StatCardTone,
  { chip: string; value: string; border: string }
> = {
  neutral: {
    chip: "bg-muted text-muted-foreground",
    value: "text-foreground",
    border: "border-border",
  },
  positive: {
    chip: "bg-success-subtle text-success-subtle-foreground",
    value: "text-foreground",
    border: "border-border",
  },
  warning: {
    chip: "bg-warning-subtle text-warning-subtle-foreground",
    value: "text-foreground",
    border: "border-warning/40",
  },
  // The only tone that colors the headline value itself — restraint means
  // color is spent on the one thing that's actually urgent.
  critical: {
    chip: "bg-destructive-subtle text-destructive-subtle-foreground",
    value: "text-destructive",
    border: "border-destructive/40",
  },
};

export function StatCard({
  title,
  value,
  icon,
  subtext,
  tone,
  onClick,
  className,
  id,
  iconBgColor,
  iconColor,
  highlightColor,
}: StatCardProps) {
  const resolved = tone ? TONE_STYLES[tone] : null;
  const interactive = Boolean(onClick);

  return (
    <div
      id={id}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        // min-w-0 lets this shrink below its content's natural width — flex
        // items default to min-width:auto, which is what let a long,
        // unbroken number push past the card's border instead of wrapping.
        "relative flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-3.5 shadow-card sm:gap-3 sm:p-5 transition-[transform,box-shadow,border-color] duration-150",
        resolved ? resolved.border : "border-border",
        !resolved && highlightColor && "sm:border-l-[3px] sm:[border-left-color:var(--stat-accent)]",
        interactive &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        className,
      )}
      // Legacy fallback: a caller still on the deprecated `highlightColor`
      // prop (not yet migrated to `tone`) keeps its old left-stripe look
      // unchanged rather than silently losing its accent.
      // (legacy stripe is sm+ only — on a two-up phone grid it read as a
      // different kind of tile from every other stat card)
      style={
        !resolved && highlightColor
          ? ({ "--stat-accent": highlightColor } as React.CSSProperties)
          : undefined
      }
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
        <span
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8 [&_svg]:max-sm:h-4 [&_svg]:max-sm:w-4",
            resolved ? resolved.chip : "bg-muted text-muted-foreground",
          )}
          style={
            !resolved && (iconBgColor || iconColor)
              ? { backgroundColor: iconBgColor, color: iconColor }
              : undefined
          }
        >
          {icon}
        </span>
        <span className="line-clamp-2 min-w-0 text-[0.6875rem] font-semibold uppercase leading-tight tracking-wide text-muted-foreground sm:tracking-wider">
          {title}
        </span>
      </div>

      <span
        className={cn(
          "break-words text-lg font-bold leading-tight tracking-tight tabular-nums sm:text-[1.625rem]",
          resolved ? resolved.value : "text-foreground",
        )}
      >
        {value}
      </span>

      {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
    </div>
  );
}
