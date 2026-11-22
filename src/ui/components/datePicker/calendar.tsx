"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons";
import {
  addDays,
  addMonths,
  addYears,
  clampToRange,
  formatLong,
  formatMonthYear,
  isOutOfRange,
  monthGrid,
  parseISODate,
  weekdayNames,
  weekdayOf,
  type ISODate,
} from "./datePicker.utils";
import { Day, DayCell, Grid, Header, NavButton, Root, Title, Weekday } from "./calendar.styles";

export interface CalendarProps {
  value: ISODate | null;
  onSelect: (date: ISODate) => void;
  /** Today, as a date string. The app supplies it (e.g. today in India) so the library never reads the local clock for a business day. */
  today: ISODate;
  min?: ISODate;
  max?: ISODate;
  /** 0 = Sunday (default), 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** Move focus to the focused day when it first appears (for a popup). */
  autoFocus?: boolean;
}

/**
 * A month grid for choosing one date, following the WAI-ARIA date-picker
 * pattern: a single day is in the tab order, the arrow keys move by day and
 * week, Home/End go to the ends of the week, PageUp/PageDown change month
 * (with Shift, year), and Enter or Space chooses.
 */
export function Calendar({ value, onSelect, today, min, max, weekStartsOn = 0, autoFocus = false }: CalendarProps) {
  const start = clampToRange(value ?? today, min, max);
  const [focused, setFocused] = useState<ISODate>(start);
  // A value changed from outside (a form reset or prefill) brings the grid to it.
  // Adjusting state while rendering is React's pattern for "state derived from a prop".
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    if (value) setFocused(clampToRange(value, min, max));
  }
  const [shouldFocus, setShouldFocus] = useState(autoFocus);
  const grid = useRef<HTMLDivElement>(null);

  const { y, m } = parseISODate(focused)!;
  const weeks = monthGrid(y, m, weekStartsOn);

  // After the focused day changes by keyboard, move DOM focus to it.
  useEffect(() => {
    if (!shouldFocus) return;
    grid.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  }, [focused, shouldFocus]);

  const move = (target: ISODate) => {
    // Stop at the first or last day that can be chosen: a disabled day can't hold focus.
    const next = clampToRange(target, min, max);
    setFocused(next);
    setShouldFocus(true);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    // Days since the start of the focused day's week.
    const intoWeek = (weekdayOf(parseISODate(focused)!) - weekStartsOn + 7) % 7;
    const keys: Record<string, ISODate | undefined> = {
      ArrowLeft: addDays(focused, -1),
      ArrowRight: addDays(focused, 1),
      ArrowUp: addDays(focused, -7),
      ArrowDown: addDays(focused, 7),
      Home: addDays(focused, -intoWeek),
      End: addDays(focused, 6 - intoWeek),
      PageUp: event.shiftKey ? addYears(focused, -1) : addMonths(focused, -1),
      PageDown: event.shiftKey ? addYears(focused, 1) : addMonths(focused, 1),
    };
    const next = keys[event.key];
    if (!next) return;
    event.preventDefault();
    move(next);
  };

  const title = formatMonthYear(y, m);

  return (
    <Root data-ui="calendar">
      <Header>
        <NavButton type="button" aria-label="Previous month" onClick={() => move(addMonths(focused, -1))}>
          <ChevronLeftIcon size={16} />
        </NavButton>
        <Title aria-live="polite">{title}</Title>
        <NavButton type="button" aria-label="Next month" onClick={() => move(addMonths(focused, 1))}>
          <ChevronRightIcon size={16} />
        </NavButton>
      </Header>

      <Grid ref={grid} role="grid" aria-label={title} onKeyDown={onKeyDown}>
        {weekdayNames(weekStartsOn).map((name) => (
          <Weekday key={name} role="columnheader" aria-label={name}>
            {name.slice(0, 2)}
          </Weekday>
        ))}
        {weeks.flat().map(({ iso, inMonth }) => {
          const { d } = parseISODate(iso)!;
          const disabled = isOutOfRange(iso, min, max);
          return (
            <DayCell key={iso} role="gridcell">
              <Day
                type="button"
                tabIndex={iso === focused ? 0 : -1}
                disabled={disabled}
                aria-label={formatLong(iso)}
                aria-selected={iso === value}
                aria-current={iso === today ? "date" : undefined}
                $selected={iso === value}
                $today={iso === today}
                $outside={!inMonth}
                onClick={() => onSelect(iso)}
                onFocus={() => setFocused(iso)}
              >
                {d}
              </Day>
            </DayCell>
          );
        })}
      </Grid>
    </Root>
  );
}
