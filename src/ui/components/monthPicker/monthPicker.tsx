"use client";

import { forwardRef, useState } from "react";
import { composeRefs } from "../../utils/composeRefs";
import { useControllableState } from "../../hooks/useControllableState";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons";
import { Popover } from "../popover";
import { Footer, FooterButton, Header, NavButton, Title } from "../datePicker/calendar.styles";
import { Trigger, TrailingIcon, Value, Wrapper } from "../datePicker/datePicker.styles";
import { formatMonthShort, monthName, parseISOMonth, toISOMonth } from "../datePicker/datePicker.utils";
import { MonthButton, MonthGrid, Panel } from "./monthPicker.styles";
import type { MonthPickerProps } from "./monthPicker.types";

/**
 * Choose a month and year, e.g. for attendance or salary periods. The value is
 * a "YYYY-MM" string (or null). Replaces the browser's own month control, which
 * not every browser supports.
 */
export const MonthPicker = forwardRef<HTMLButtonElement, MonthPickerProps>(function MonthPicker(
  {
    value,
    defaultValue = null,
    onValueChange,
    min,
    max,
    currentMonth,
    placeholder = "Select month",
    clearable = false,
    invalid = false,
    disabled,
    onClick,
    ...props
  },
  ref,
) {
  const [month, setMonth] = useControllableState<string | null>({
    value,
    defaultValue,
    onChange: onValueChange,
  });
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const selected = parseISOMonth(month) ? month : null;
  const [year, setYear] = useState(() => (parseISOMonth(selected) ?? parseISOMonth(currentMonth))?.y ?? 1970);

  const outOfRange = (iso: string) => (!!min && iso < min) || (!!max && iso > max);
  const choose = (iso: string | null) => {
    setMonth(iso);
    setOpen(false);
    anchor?.focus({ preventScroll: true });
  };

  return (
    <Wrapper data-ui="month-picker">
      <Trigger
        {...props}
        ref={composeRefs(ref, setAnchor)}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        $empty={!selected}
        $invalid={invalid}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          if (!open) setYear((parseISOMonth(selected) ?? parseISOMonth(currentMonth) ?? { y: year }).y);
          setOpen((o) => !o);
        }}
      >
        <Value>{selected ? formatMonthShort(selected) : placeholder}</Value>
        <TrailingIcon size={16} />
      </Trigger>

      <Popover open={open && !disabled} onOpenChange={setOpen} anchor={anchor} width={288}>
        <Panel data-ui="month-panel">
          <Header>
            <NavButton type="button" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeftIcon size={16} />
            </NavButton>
            <Title aria-live="polite">{year}</Title>
            <NavButton type="button" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
              <ChevronRightIcon size={16} />
            </NavButton>
          </Header>
          <MonthGrid role="group" aria-label={`Months of ${year}`}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const iso = toISOMonth(year, m);
              return (
                <MonthButton
                  key={iso}
                  type="button"
                  aria-pressed={iso === selected}
                  aria-label={`${monthName(m)} ${year}`}
                  disabled={outOfRange(iso)}
                  $selected={iso === selected}
                  $current={iso === currentMonth}
                  onClick={() => choose(iso)}
                >
                  {monthName(m)}
                </MonthButton>
              );
            })}
          </MonthGrid>
          <Footer>
            <FooterButton type="button" disabled={outOfRange(currentMonth)} onClick={() => choose(currentMonth)}>
              This month
            </FooterButton>
            {clearable && (
              <FooterButton type="button" disabled={!selected} onClick={() => choose(null)}>
                Clear
              </FooterButton>
            )}
          </Footer>
        </Panel>
      </Popover>
    </Wrapper>
  );
});
