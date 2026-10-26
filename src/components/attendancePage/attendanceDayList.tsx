"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckIcon, MoreHorizontalIcon, SettingsIcon, XIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  shiftsFor,
  type AttendanceDayDriver,
  type AttendanceMark,
  type OffStatus,
  type ShiftCount,
} from "./attendancePage.types";
import {
  EMPTY_MARK,
  fullDayFor,
  initials,
  isFullDay,
  isMarked,
  isShiftlessPresent,
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
  /** Opens "shifts per day" for a driver. Omitted for roles that may not set it. */
  onEditShiftCount?: (driver: AttendanceDayDriver) => void;
}

const PRESENT_MARK: AttendanceMark = { shifts: [], status: "PRESENT" };

// Only the off-day statuses live in this record — "PRESENT" (shift-less, for
// a PER_TRIP driver) isn't an "off" state and has its own dedicated control,
// not a clear-labelled pill the way Absent/Leave/Holiday do.
const OFF_LABEL: Record<Exclude<OffStatus, "PRESENT">, string> = {
  ABSENT: "Absent",
  LEAVE: "Leave",
  HOLIDAY: "Holiday",
};
const OFF_STATUSES = ["ABSENT", "LEAVE", "HOLIDAY"] as const;

/** Absent/leave/holiday toggle off when tapped again, and always clear any shifts. */
function withOff(mark: AttendanceMark, status: (typeof OFF_STATUSES)[number]): AttendanceMark {
  return mark.status === status ? EMPTY_MARK : { shifts: [], status };
}

/** A full day is this driver's own shifts, so a 2-shift driver gets A + B. */
function withFullDay(mark: AttendanceMark, count: ShiftCount): AttendanceMark {
  return isFullDay(mark, count) ? EMPTY_MARK : fullDayFor(count);
}

/** Present (no shifts) toggles off when tapped again, for a PER_TRIP driver. */
function withShiftlessPresent(mark: AttendanceMark): AttendanceMark {
  return isShiftlessPresent(mark) ? EMPTY_MARK : PRESENT_MARK;
}

/**
 * Colour carries meaning here, not decoration: green is present (the tick and
 * the shifts worked), red is absent, amber is leave/holiday or not yet
 * marked. Blue is kept for things you act on — Save, the selected tab — so
 * it never means "status".
 *
 * One row per driver. Desktop spells every choice out (Full day · A B C ·
 * Absent · Leave · Holiday); phones fold the same choices into a tick, a
 * three-cell shift block and a "more" menu so a row stays one line tall and
 * roughly twice as many drivers fit on screen. A PER_TRIP driver (paid by
 * trip count, set on the Salaries page) gets no shift controls at all —
 * just Present / Absent / Leave / Holiday, since which shift they drove
 * doesn't affect their pay.
 */
export function AttendanceDayList(props: AttendanceDayListProps) {
  return props.isMobile ? <PhoneList {...props} /> : <DesktopList {...props} />;
}

/**
 * A coloured edge down the left of every row, so the day can be read by
 * scanning one column: green worked, red absent, amber leave/holiday, and a
 * paler amber (with a tinted row) for a driver who still has to be marked.
 */
function statusEdge(mark: AttendanceMark): string {
  if (mark.status === "ABSENT") return "border-l-destructive";
  if (mark.status === "LEAVE" || mark.status === "HOLIDAY") return "border-l-warning";
  if (mark.shifts.length > 0 || mark.status === "PRESENT") {
    return "border-l-success-subtle-foreground/70";
  }
  return "border-l-warning/70";
}

// ─── Desktop ───

// The choices sit in joined groups (worked · off) rather than separate
// chips, and every cell has a fixed width so A, B and C line up as columns
// down the page.
const groupBase = "inline-flex overflow-hidden rounded-lg border border-border bg-card";
const cellBase =
  "inline-flex h-9 items-center justify-center border-l border-border px-3 text-sm font-semibold transition-colors first:border-l-0 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";
const cellIdle = "text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground";

function DesktopList({
  drivers,
  marks,
  editable,
  onChange,
  onEditShiftCount,
}: AttendanceDayListProps) {
  return (
    <ul className="divide-y divide-border">
      {drivers.map((driver) => {
        const mark = marks[driver.driver_id] ?? EMPTY_MARK;
        const set = (next: AttendanceMark) => onChange(driver.driver_id, next);
        const tripBased = driver.pay_type === "PER_TRIP";
        // Only the shifts this driver runs are offered; the rest never existed
        // for them, so showing a greyed-out C would only invite a question.
        const shifts = tripBased ? [] : shiftsFor(driver.shift_count);
        const full = isFullDay(mark, driver.shift_count);
        const present = tripBased ? isShiftlessPresent(mark) : full;
        return (
          <li
            key={driver.driver_id}
            data-testid={`attendance-row-${driver.driver_id}`}
            className={cn(
              // Wraps below ~1100px of content: at tablet width the controls
              // would otherwise squeeze the name to nothing.
              "flex flex-wrap items-center gap-x-3 gap-y-2 border-l-4 py-2.5 pl-3 pr-4 sm:pl-5 sm:pr-6",
              statusEdge(mark),
              !isMarked(mark) && "bg-warning-subtle/30",
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
                {tripBased ? (
                  <Badge variant="outline">Per trip</Badge>
                ) : (
                  // Only worth saying when it is not the usual three.
                  driver.shift_count !== 3 && (
                    <Badge variant="outline">
                      {driver.shift_count === 1 ? "1 shift/day" : `${driver.shift_count} shifts/day`}
                    </Badge>
                  )
                )}
                {mark.status === "HOLIDAY" ? (
                  <Badge variant="warning-subtle">Holiday</Badge>
                ) : tripBased ? (
                  present ? (
                    <Badge variant="success-subtle">Present</Badge>
                  ) : !isMarked(mark) ? (
                    <Badge variant="warning-subtle">Not marked</Badge>
                  ) : null
                ) : full ? (
                  <Badge variant="success-subtle">Full day</Badge>
                ) : mark.shifts.length > 1 ? (
                  <Badge variant="success-subtle">Double shift</Badge>
                ) : !isMarked(mark) ? (
                  <Badge variant="warning-subtle">Not marked</Badge>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3" role="group" aria-label={driver.name}>
              {tripBased ? (
                <button
                  type="button"
                  disabled={!editable}
                  aria-pressed={present}
                  onClick={() => set(withShiftlessPresent(mark))}
                  className={cn(
                    cellBase,
                    groupBase,
                    "w-24",
                    present ? "bg-success text-success-foreground" : cellIdle,
                  )}
                >
                  Present
                </button>
              ) : (
                <div className={groupBase}>
                  <button
                    type="button"
                    disabled={!editable}
                    aria-pressed={full}
                    onClick={() => set(withFullDay(mark, driver.shift_count))}
                    className={cn(
                      cellBase,
                      "w-24",
                      full ? "bg-success text-success-foreground" : cellIdle,
                    )}
                  >
                    Full day
                  </button>
                  {shifts.map((shift) => {
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
                          cellBase,
                          "w-11 px-0",
                          // Tinted, not solid: "Full day" beside it is the solid
                          // one, so a full roster isn't a wall of colour.
                          on ? "bg-success-subtle text-success-subtle-foreground" : cellIdle,
                        )}
                      >
                        {shift}
                      </button>
                    );
                  })}
                </div>
              )}
              {onEditShiftCount && !tripBased && (
                <button
                  type="button"
                  disabled={!editable}
                  title={`Shifts per day for ${driver.name}`}
                  aria-label={`Shifts per day for ${driver.name}`}
                  onClick={() => onEditShiftCount(driver)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                >
                  <SettingsIcon size={16} />
                </button>
              )}
              <div className={groupBase}>
                {OFF_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={!editable}
                    aria-pressed={mark.status === status}
                    onClick={() => set(withOff(mark, status))}
                    className={cn(
                      cellBase,
                      status === "HOLIDAY" ? "w-[5.5rem]" : "w-[4.5rem]",
                      mark.status === status
                        ? status === "ABSENT"
                          ? "bg-destructive-subtle text-destructive-subtle-foreground"
                          : "bg-warning-subtle text-warning-subtle-foreground"
                        : cellIdle,
                    )}
                  >
                    {OFF_LABEL[status]}
                  </button>
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Phone ───

function PhoneList({
  drivers,
  marks,
  editable,
  onChange,
  onEditShiftCount,
}: AttendanceDayListProps) {
  // Only one row's Absent / Leave / Holiday / Clear menu is open at a time.
  const [menuFor, setMenuFor] = useState<number | null>(null);

  return (
    // One card per driver, as in the Flutter app; an unmarked driver's card
    // carries an amber edge so the gaps stand out.
    <ul className="flex flex-col gap-1.5">
      {drivers.map((driver) => {
        const mark = marks[driver.driver_id] ?? EMPTY_MARK;
        const set = (next: AttendanceMark) => {
          onChange(driver.driver_id, next);
          setMenuFor(null);
        };
        const tripBased = driver.pay_type === "PER_TRIP";
        const shifts = tripBased ? [] : shiftsFor(driver.shift_count);
        const full = isFullDay(mark, driver.shift_count);
        const partial = !tripBased && !full && mark.shifts.length > 0;
        const present = tripBased ? isShiftlessPresent(mark) : full;
        const menuOpen = menuFor === driver.driver_id;

        return (
          <li
            key={driver.driver_id}
            data-testid={`attendance-row-${driver.driver_id}`}
            className={cn(
              "flex flex-wrap items-center gap-1 rounded-[var(--m-radius-card)] border bg-card py-1 pl-0.5 pr-1",
              isMarked(mark) ? "border-border" : "border-warning/55",
            )}
          >
            {/* The tick is the one-tap "present all day"; for a shift-based
                driver it reads as a tri-state checkbox over the shifts
                beside it, for a PER_TRIP driver it's simply Present. */}
            <button
              type="button"
              disabled={!editable}
              aria-pressed={present}
              aria-label={`${tripBased ? "Present" : "Full day"}, ${driver.name}`}
              onClick={() =>
                set(tripBased ? withShiftlessPresent(mark) : withFullDay(mark, driver.shift_count))
              }
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center disabled:opacity-60"
            >
              <span
                className={cn(
                  "flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 text-sm font-bold leading-none transition-colors",
                  present && "border-success bg-success text-success-foreground",
                  partial && "border-success text-success-subtle-foreground",
                  !present && !partial && "border-muted-foreground/45 text-transparent",
                  mark.status && mark.status !== "PRESENT" && "border-dashed",
                )}
              >
                {partial ? "–" : <CheckIcon size={15} />}
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-foreground">{driver.name}</div>
              <div
                className={cn(
                  "truncate text-[12.5px]",
                  isMarked(mark)
                    ? "text-muted-foreground"
                    : "font-semibold text-warning-subtle-foreground",
                )}
              >
                {markLabel(mark, driver.shift_count)}
                {!tripBased &&
                  driver.shift_count !== 3 &&
                  mark.status !== null &&
                  ` · ${driver.shift_count === 1 ? "1 shift" : `${driver.shift_count} shifts`}`}
                {tripBased && !isMarked(mark) && " · Per trip"}
                {!driver.is_active && " · Inactive"}
              </div>
            </div>

            {mark.status && mark.status !== "PRESENT" ? (
              <button
                type="button"
                disabled={!editable}
                aria-label={`Clear ${OFF_LABEL[mark.status]}, ${driver.name}`}
                onClick={() => set(EMPTY_MARK)}
                className={cn(
                  "inline-flex h-10 w-[7.125rem] shrink-0 items-center justify-center gap-2 rounded-[10px] border text-[13.5px] font-bold disabled:opacity-60",
                  mark.status === "ABSENT"
                    ? "border-destructive/35 bg-destructive-subtle text-destructive-subtle-foreground"
                    : "border-warning/45 bg-warning-subtle text-warning-subtle-foreground",
                )}
              >
                {OFF_LABEL[mark.status]}
                {editable && <XIcon size={14} />}
              </button>
            ) : tripBased ? (
              // A PER_TRIP driver has no shift cells to show in this slot —
              // the tick on the left already is their only "present" control,
              // so this space stays empty rather than showing an empty group.
              <div className="w-0 shrink-0" />
            ) : (
              <div
                role="group"
                aria-label={`Shifts, ${driver.name}`}
                className={cn(
                  "flex shrink-0 overflow-hidden rounded-[10px] border",
                  // The solid tick says "present all day"; the cells only
                  // tint, so a full roster isn't a wall of colour.
                  mark.shifts.length > 0 ? "border-success/30" : "border-border",
                )}
              >
                {shifts.map((shift) => {
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
                        "h-10 w-[38px] border-l border-border text-[13.5px] font-extrabold first:border-l-0 disabled:opacity-60",
                        on
                          ? "border-l-success/30 bg-success-subtle text-success"
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
              <div className="flex w-full flex-wrap gap-1.5 pb-1.5 pl-11 pr-1">
                {OFF_STATUSES.map((status) => (
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
                {onEditShiftCount && !tripBased && (
                  <button
                    type="button"
                    disabled={!editable}
                    aria-label={`Shifts per day for ${driver.name}`}
                    onClick={() => {
                      setMenuFor(null);
                      onEditShiftCount(driver);
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground active:bg-muted disabled:opacity-50"
                  >
                    <SettingsIcon size={16} />
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
