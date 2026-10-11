"use client";

import React, { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  SHIFTS,
  type AttendanceMark,
  type AttendanceMonth,
  type AttendanceMonthDriver,
} from "./attendancePage.types";
import { EMPTY_MARK, datesInMonth, isFullDay, markLabel, weekday } from "./attendancePage.utils";

export interface AttendanceMonthViewProps {
  data: AttendanceMonth;
  isMobile: boolean;
  /** Opens a date in the daily view for marking. */
  onOpenDay: (date: string) => void;
}

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * One day in the register: three bars for A, B and C, or a tinted A / L for
 * absent and leave. The same mark is used in the desktop grid and the phone
 * calendar so the two read identically.
 */
function MarkCell({
  mark,
  label,
  onClick,
}: {
  mark: AttendanceMark;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-5 w-[1.625rem] items-center justify-center gap-0.5 rounded-xs text-[0.6875rem] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        mark.status === "ABSENT" && "bg-destructive-subtle text-destructive-subtle-foreground",
        mark.status === "LEAVE" && "bg-warning-subtle text-warning-subtle-foreground",
      )}
    >
      {mark.status
        ? mark.status === "ABSENT"
          ? "A"
          : "L"
        : SHIFTS.map((shift) => (
            <span
              key={shift}
              className={cn(
                "h-3.5 w-1.5 rounded-[2px]",
                mark.shifts.includes(shift) ? "bg-success-subtle-foreground" : "bg-border",
              )}
            />
          ))}
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex gap-0.5">
          <span className="h-3.5 w-1.5 rounded-[2px] bg-success-subtle-foreground" />
          <span className="h-3.5 w-1.5 rounded-[2px] bg-border" />
          <span className="h-3.5 w-1.5 rounded-[2px] bg-border" />
        </span>
        Shifts A · B · C
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-4 w-5 items-center justify-center rounded-xs bg-destructive-subtle text-[0.625rem] font-bold text-destructive-subtle-foreground">
          A
        </span>
        Absent
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-4 w-5 items-center justify-center rounded-xs bg-warning-subtle text-[0.625rem] font-bold text-warning-subtle-foreground">
          L
        </span>
        Leave
      </span>
    </div>
  );
}

export function AttendanceMonthView({ data, isMobile, onOpenDay }: AttendanceMonthViewProps) {
  const dates = datesInMonth(data.month);
  return isMobile ? (
    <PhoneMonth data={data} dates={dates} onOpenDay={onOpenDay} />
  ) : (
    <DesktopRegister data={data} dates={dates} onOpenDay={onOpenDay} />
  );
}

interface MonthLayoutProps {
  data: AttendanceMonth;
  dates: string[];
  onOpenDay: (date: string) => void;
}

// ─── Desktop: the muster roll — drivers down, days across ───

function DesktopRegister({ data, dates, onOpenDay }: MonthLayoutProps) {
  const cellTone = (date: string) =>
    cn(weekday(date) === 0 && "bg-muted", date === data.today && "shadow-[inset_1px_0_0_var(--primary),inset_-1px_0_0_var(--primary)]");

  return (
    <div className="space-y-4">
      <Legend />
      {/* Scrolls both ways inside its own box so, with 30–40 drivers, the day
          numbers stay on screen as well as the names. */}
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-border">
        <table className="w-full border-separate border-spacing-0 text-xs tabular-nums">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-36 border-b border-r border-border bg-card px-4 py-2 text-left text-sm font-semibold text-muted-foreground">
                Driver
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  className={cn(
                    "sticky top-0 z-20 border-b border-border bg-card px-0.5 py-1.5 text-center font-semibold text-muted-foreground",
                    cellTone(date),
                  )}
                >
                  {Number(date.slice(8))}
                  <span className="block text-[0.625rem] font-normal">
                    {WEEKDAY_INITIALS[weekday(date)]}
                  </span>
                </th>
              ))}
              {["Days", "Full", "Shifts", "Abs", "Lv"].map((heading, i) => (
                <th
                  key={heading}
                  className={cn(
                    "sticky top-0 z-20 border-b border-border bg-card px-2.5 py-2 text-center font-semibold text-muted-foreground",
                    i === 0 && "border-l",
                  )}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.drivers.map((driver) => (
              <tr key={driver.driver_id} className="[&:last-child>td]:border-b-0">
                <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-border bg-card px-4 py-1.5 text-sm font-semibold text-foreground">
                  {driver.name}
                </td>
                {dates.map((date) => {
                  const mark = driver.days[date] ?? EMPTY_MARK;
                  return (
                    <td
                      key={date}
                      className={cn("border-b border-border px-0.5 py-1.5 text-center", cellTone(date))}
                    >
                      {date <= data.today && (
                        <MarkCell
                          mark={mark}
                          label={`${driver.name}, ${Number(date.slice(8))}: ${markLabel(mark)}`}
                          onClick={() => onOpenDay(date)}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="border-b border-l border-border px-2.5 text-center text-sm">
                  {driver.totals.days_present}
                </td>
                <td className="border-b border-border px-2.5 text-center text-sm">
                  {driver.totals.full_days}
                </td>
                <td className="border-b border-border px-2.5 text-center text-sm font-semibold">
                  {driver.totals.shifts}
                </td>
                <td
                  className={cn(
                    "border-b border-border px-2.5 text-center text-sm",
                    driver.totals.absent >= 3 && "font-semibold text-destructive",
                  )}
                >
                  {driver.totals.absent}
                </td>
                <td className="border-b border-border px-2.5 text-center text-sm">
                  {driver.totals.leave}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Phone: a card per driver with the month as one strip ───

function stripTone(mark: AttendanceMark | undefined, future: boolean): string {
  if (future) return "bg-muted";
  if (!mark) return "bg-card shadow-[inset_0_0_0_1px_var(--border)]";
  if (mark.status === "ABSENT") return "bg-destructive";
  if (mark.status === "LEAVE") return "bg-warning";
  return isFullDay(mark) ? "bg-success-subtle-foreground" : "bg-success-subtle-foreground/45";
}

function PhoneMonth({ data, dates, onOpenDay }: MonthLayoutProps) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground">
        {[
          ["bg-success-subtle-foreground", "Full day"],
          ["bg-success-subtle-foreground/45", "Part"],
          ["bg-destructive", "Absent"],
          ["bg-warning", "Leave"],
        ].map(([tone, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-[2px]", tone)} />
            {label}
          </span>
        ))}
      </div>

      <ul className="space-y-2">
        {data.drivers.map((driver) => (
          <PhoneMonthCard
            key={driver.driver_id}
            driver={driver}
            dates={dates}
            today={data.today}
            open={openId === driver.driver_id}
            onToggle={() => setOpenId(openId === driver.driver_id ? null : driver.driver_id)}
            onOpenDay={onOpenDay}
          />
        ))}
      </ul>
    </div>
  );
}

function PhoneMonthCard({
  driver,
  dates,
  today,
  open,
  onToggle,
  onOpenDay,
}: {
  driver: AttendanceMonthDriver;
  dates: string[];
  today: string;
  open: boolean;
  onToggle: () => void;
  onOpenDay: (date: string) => void;
}) {
  return (
    <li className="rounded-xl border border-border bg-card shadow-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 p-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{driver.name}</span>
          <span className="block text-xs text-muted-foreground">
            {driver.totals.absent} absent · {driver.totals.leave} leave
          </span>
        </span>
        <span className="text-right text-[0.6875rem] leading-tight text-muted-foreground">
          <span className="block text-lg font-bold tabular-nums text-foreground">
            {driver.totals.shifts}
          </span>
          shifts
        </span>
        <span className="text-muted-foreground">
          {open ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
        </span>
        {/* The whole month at a glance: one cell per day. */}
        <span
          className="grid w-full gap-0.5"
          style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {dates.map((date) => (
            <span
              key={date}
              className={cn("h-3.5 rounded-[2px]", stripTone(driver.days[date], date > today))}
            />
          ))}
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-7 gap-1 px-3 pb-3">
          {WEEKDAY_INITIALS.map((initial, i) => (
            <span key={i} className="text-center text-[0.625rem] font-semibold text-muted-foreground">
              {initial}
            </span>
          ))}
          {Array.from({ length: weekday(dates[0]) }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {dates.map((date) => {
            const mark = driver.days[date] ?? EMPTY_MARK;
            return (
              <span
                key={date}
                className={cn(
                  "flex min-h-11 flex-col items-center gap-0.5 rounded-md py-1 text-[0.6875rem] tabular-nums text-muted-foreground",
                  weekday(date) === 0 && "bg-muted",
                  date === today && "ring-1 ring-primary",
                )}
              >
                {Number(date.slice(8))}
                {date <= today && (
                  <MarkCell
                    mark={mark}
                    label={`${driver.name}, ${Number(date.slice(8))}: ${markLabel(mark)}`}
                    onClick={() => onOpenDay(date)}
                  />
                )}
              </span>
            );
          })}
        </div>
      )}
    </li>
  );
}
