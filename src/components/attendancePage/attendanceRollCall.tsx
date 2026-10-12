"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { SHIFTS, type AttendanceFilter, type Shift } from "./attendancePage.types";

export interface AttendanceRollCallCounts {
  total: number;
  present: number;
  absent: number;
  leave: number;
  unmarked: number;
  shift: Record<Shift, number>;
}

export interface AttendanceRollCallProps {
  counts: AttendanceRollCallCounts;
  filter: AttendanceFilter;
  onFilter: (filter: AttendanceFilter) => void;
  /** Phones show the bar and one line of text; desktop adds the breakdown. */
  compact?: boolean;
}

interface Segment {
  key: "present" | "absent" | "leave" | "unmarked";
  label: string;
  tone: string;
  filter: AttendanceFilter;
}

const SEGMENTS: Segment[] = [
  { key: "present", label: "Present", tone: "bg-success-subtle-foreground", filter: "present" },
  { key: "absent", label: "Absent", tone: "bg-destructive", filter: "off" },
  { key: "leave", label: "Leave", tone: "bg-warning", filter: "off" },
  {
    key: "unmarked",
    label: "Not marked",
    // Hatched rather than flat grey: an empty stretch of the bar is the work
    // still to do, so it should look unfinished.
    tone: "bg-muted [background-image:repeating-linear-gradient(135deg,transparent_0_4px,var(--border)_4px_5px)]",
    filter: "unmarked",
  },
];

/**
 * The day at a glance: one bar split into present, absent, leave and not yet
 * marked. The hatched segment shrinks as the roster gets marked, so progress
 * reads without counting. Each segment doubles as the matching filter.
 */
export function AttendanceRollCall({ counts, filter, onFilter, compact }: AttendanceRollCallProps) {
  const { total } = counts;
  const marked = total - counts.unmarked;
  const done = total > 0 && counts.unmarked === 0;

  return (
    <div className={cn("min-w-0", !compact && "space-y-3")}>
      <div className={cn("flex items-center gap-3", compact ? "text-[0.6875rem]" : "justify-between")}>
        {!compact && (
          <p className="text-sm text-muted-foreground">
            <span className="text-2xl font-semibold tabular-nums text-foreground">{marked}</span>
            <span className="tabular-nums"> of {total} drivers marked</span>
            {done && <span className="ml-2 font-medium text-success-subtle-foreground">All done</span>}
          </p>
        )}
        <div
          role="group"
          aria-label="Roll call"
          className={cn(
            "flex min-w-0 flex-1 gap-0.5 overflow-hidden rounded-full",
            compact ? "h-1.5" : "h-3",
          )}
        >
          {SEGMENTS.map((segment) => {
            const value = counts[segment.key];
            if (value === 0) return null;
            return (
              <button
                key={segment.key}
                type="button"
                title={`${segment.label}: ${value}`}
                aria-label={`${segment.label}: ${value}`}
                aria-pressed={filter === segment.filter}
                onClick={() => onFilter(filter === segment.filter ? "all" : segment.filter)}
                // Width eases so marking a driver visibly moves the bar.
                style={{ flexGrow: value, flexBasis: 0 }}
                className={cn(
                  "min-w-1 transition-[flex-grow] duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  segment.tone,
                  filter !== "all" && filter !== segment.filter && "opacity-45",
                )}
              />
            );
          })}
        </div>
        {compact && (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {marked} of {total} marked
          </span>
        )}
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {SEGMENTS.map((segment) => (
            <div key={segment.key} className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-[3px]", segment.tone)} aria-hidden="true" />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="font-semibold tabular-nums text-foreground">{counts[segment.key]}</span>
            </div>
          ))}
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
          {SHIFTS.map((shift) => (
            <button
              key={shift}
              type="button"
              aria-pressed={filter === shift}
              onClick={() => onFilter(filter === shift ? "all" : shift)}
              className={cn(
                "flex items-center gap-2 rounded-md px-1.5 py-0.5 -mx-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === shift && "bg-muted",
              )}
            >
              <span className="text-muted-foreground">Shift {shift}</span>
              <span className="font-semibold tabular-nums text-foreground">{counts.shift[shift]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
