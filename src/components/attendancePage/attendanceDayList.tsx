"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckIcon, MoreHorizontalIcon, XIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  SHIFTS,
  type AttendanceDayDriver,
  type AttendanceMark,
  type OffStatus,
} from "./attendancePage.types";
import {
  EMPTY_MARK,
  FULL_DAY,
  initials,
  isFullDay,
  isMarked,
  markLabel,
  toggleShift,
} from "./attendancePage.utils";

export interface AttendanceDayListProps {
  drivers: AttendanceDayDriver[];
  marks: Record<number, AttendanceMark>;
  /** False for a date this role may not change — every control is disabled. */
  editable: boolean;
  isMobile: boolean;
  onChange: (driverId: number, mark: AttendanceMark) => void;
}

const OFF_LABEL: Record<OffStatus, string> = { ABSENT: "Absent", LEAVE: "Leave" };

/** Absent/leave toggle off when tapped again, and always clear any shifts. */
function withOff(mark: AttendanceMark, status: OffStatus): AttendanceMark {
  return mark.status === status ? EMPTY_MARK : { shifts: [], status };
}

function withFullDay(mark: AttendanceMark): AttendanceMark {
  return isFullDay(mark) ? EMPTY_MARK : FULL_DAY;
}

/**
 * Colour carries meaning here, not decoration: green is present (the tick and
 * the shifts worked), red is absent, amber is leave or not yet marked. Blue
 * is kept for things you act on — Save, the selected tab — so it never means
 * "status".
 *
 * One row per driver. Desktop spells every choice out (Full day · A B C ·
 * Absent · Leave); phones fold the same choices into a tick, a three-cell
 * shift block and a "more" menu so a row stays one line tall and roughly
 * twice as many drivers fit on screen.
 */
export function AttendanceDayList(props: AttendanceDayListProps) {
  return props.isMobile ? <PhoneList {...props} /> : <DesktopList {...props} />;
}

// ─── Desktop ───

const chipBase =
  "inline-flex h-9 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
const chipIdle = "border-border bg-card text-muted-foreground enabled:hover:border-muted-foreground";

function DesktopList({ drivers, marks, editable, onChange }: AttendanceDayListProps) {
  return (
    <ul className="divide-y divide-border">
      {drivers.map((driver) => {
        const mark = marks[driver.driver_id] ?? EMPTY_MARK;
        const set = (next: AttendanceMark) => onChange(driver.driver_id, next);
        return (
          <li
            key={driver.driver_id}
            data-testid={`attendance-row-${driver.driver_id}`}
            className={cn(
              // Wraps below ~1100px of content: at tablet width the six
              // controls would otherwise squeeze the name to nothing.
              "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6",
              !isMarked(mark) && "bg-warning-subtle/40",
            )}
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
              {initials(driver.name)}
            </span>
            <div className="min-w-40 flex-1">
              <div className="truncate font-semibold text-foreground">{driver.name}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {driver.place && <span>{driver.place}</span>}
                {!driver.is_active && <Badge variant="outline">Inactive</Badge>}
                {isFullDay(mark) ? (
                  <Badge variant="success-subtle">Full day</Badge>
                ) : mark.shifts.length > 1 ? (
                  <Badge variant="success-subtle">Double shift</Badge>
                ) : !isMarked(mark) ? (
                  <Badge variant="warning-subtle">Not marked</Badge>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={driver.name}>
              <button
                type="button"
                disabled={!editable}
                aria-pressed={isFullDay(mark)}
                onClick={() => set(withFullDay(mark))}
                className={cn(
                  chipBase,
                  isFullDay(mark) ? "border-success bg-success text-success-foreground" : chipIdle,
                )}
              >
                Full day
              </button>
              <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
              {SHIFTS.map((shift) => {
                const on = mark.shifts.includes(shift);
                return (
                  <button
                    key={shift}
                    type="button"
                    disabled={!editable}
                    aria-pressed={on}
                    aria-label={`Shift ${shift}`}
                    onClick={() => set(toggleShift(mark, shift))}
                    className={cn(
                      chipBase,
                      // Tinted, not solid: "Full day" beside it is the solid
                      // one, so a full roster isn't a wall of colour.
                      on
                        ? "border-success/35 bg-success-subtle text-success-subtle-foreground"
                        : chipIdle,
                    )}
                  >
                    {shift}
                  </button>
                );
              })}
              <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
              <button
                type="button"
                disabled={!editable}
                aria-pressed={mark.status === "ABSENT"}
                onClick={() => set(withOff(mark, "ABSENT"))}
                className={cn(
                  chipBase,
                  mark.status === "ABSENT"
                    ? "border-destructive/40 bg-destructive-subtle text-destructive-subtle-foreground"
                    : chipIdle,
                )}
              >
                Absent
              </button>
              <button
                type="button"
                disabled={!editable}
                aria-pressed={mark.status === "LEAVE"}
                onClick={() => set(withOff(mark, "LEAVE"))}
                className={cn(
                  chipBase,
                  mark.status === "LEAVE"
                    ? "border-warning/45 bg-warning-subtle text-warning-subtle-foreground"
                    : chipIdle,
                )}
              >
                Leave
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Phone ───

function PhoneList({ drivers, marks, editable, onChange }: AttendanceDayListProps) {
  // Only one row's Absent / Leave / Clear menu is open at a time.
  const [menuFor, setMenuFor] = useState<number | null>(null);

  return (
    <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {drivers.map((driver) => {
        const mark = marks[driver.driver_id] ?? EMPTY_MARK;
        const set = (next: AttendanceMark) => {
          onChange(driver.driver_id, next);
          setMenuFor(null);
        };
        const full = isFullDay(mark);
        const partial = !full && mark.shifts.length > 0;
        const menuOpen = menuFor === driver.driver_id;

        return (
          <li
            key={driver.driver_id}
            data-testid={`attendance-row-${driver.driver_id}`}
            className="flex flex-wrap items-center gap-1 border-b border-border py-1 pl-0.5 pr-1 last:border-b-0"
          >
            {/* The tick is the one-tap "present all day"; it reads as a
                tri-state checkbox over the three shifts beside it. */}
            <button
              type="button"
              disabled={!editable}
              aria-pressed={full}
              aria-label={`Full day, ${driver.name}`}
              onClick={() => set(withFullDay(mark))}
              className="flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-60"
            >
              <span
                className={cn(
                  "flex h-[1.375rem] w-[1.375rem] items-center justify-center rounded-sm border-2 text-sm font-bold leading-none",
                  full && "border-success bg-success text-success-foreground",
                  partial && "border-success text-success-subtle-foreground",
                  !full && !partial && "border-muted-foreground/45 text-transparent",
                  mark.status && "border-dashed",
                )}
              >
                {partial ? "–" : <CheckIcon size={12} />}
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{driver.name}</div>
              <div
                className={cn(
                  "truncate text-xs",
                  isMarked(mark)
                    ? "text-muted-foreground"
                    : "font-semibold text-warning-subtle-foreground",
                )}
              >
                {markLabel(mark)}
                {!driver.is_active && " · Inactive"}
              </div>
            </div>

            {mark.status ? (
              <button
                type="button"
                disabled={!editable}
                aria-label={`Clear ${OFF_LABEL[mark.status]}, ${driver.name}`}
                onClick={() => set(EMPTY_MARK)}
                className={cn(
                  "inline-flex h-9 w-[6.875rem] shrink-0 items-center justify-center gap-2 rounded-lg border text-sm font-semibold disabled:opacity-60",
                  mark.status === "ABSENT"
                    ? "border-destructive/35 bg-destructive-subtle text-destructive-subtle-foreground"
                    : "border-warning/45 bg-warning-subtle text-warning-subtle-foreground",
                )}
              >
                {OFF_LABEL[mark.status]}
                {editable && <XIcon size={14} />}
              </button>
            ) : (
              <div
                role="group"
                aria-label={`Shifts, ${driver.name}`}
                className={cn(
                  "flex shrink-0 overflow-hidden rounded-lg border",
                  // The solid tick says "present all day"; the cells only
                  // tint, so a full roster isn't a wall of colour.
                  mark.shifts.length > 0 ? "border-success/30" : "border-border",
                )}
              >
                {SHIFTS.map((shift) => {
                  const on = mark.shifts.includes(shift);
                  return (
                    <button
                      key={shift}
                      type="button"
                      disabled={!editable}
                      aria-pressed={on}
                      aria-label={`Shift ${shift}`}
                      onClick={() => set(toggleShift(mark, shift))}
                      className={cn(
                        "h-9 w-9 border-l border-border text-sm font-bold first:border-l-0 disabled:opacity-60",
                        on
                          ? "border-l-success/30 bg-success-subtle text-success-subtle-foreground"
                          : "bg-card text-muted-foreground",
                      )}
                    >
                      {shift}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              disabled={!editable}
              aria-expanded={menuOpen}
              aria-label={`More for ${driver.name}`}
              onClick={() => setMenuFor(menuOpen ? null : driver.driver_id)}
              className={cn(
                "flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-40",
                menuOpen && "bg-muted text-foreground",
              )}
            >
              <MoreHorizontalIcon size={18} />
            </button>

            {menuOpen && (
              <div className="flex w-full gap-1.5 pb-1.5 pl-11 pr-1">
                {(["ABSENT", "LEAVE"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => set({ shifts: [], status })}
                    className="h-9 flex-1 rounded-lg border border-border bg-card text-sm font-medium text-foreground active:bg-muted"
                  >
                    {OFF_LABEL[status]}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!isMarked(mark)}
                  onClick={() => set(EMPTY_MARK)}
                  className="h-9 flex-1 rounded-lg border border-border bg-card text-sm font-medium text-foreground active:bg-muted disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
