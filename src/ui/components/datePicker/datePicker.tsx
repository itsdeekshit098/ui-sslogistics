"use client";

import { forwardRef, useState } from "react";
import { composeRefs } from "../../utils/composeRefs";
import { useControllableState } from "../../hooks/useControllableState";
import { Popover } from "../popover";
import { Calendar } from "./calendar";
import { Footer, FooterButton } from "./calendar.styles";
import { Trigger, TrailingIcon, Value, Wrapper } from "./datePicker.styles";
import { formatDisplay, isOutOfRange, parseISODate } from "./datePicker.utils";
import type { DatePickerProps } from "./datePicker.types";

/**
 * Choose a calendar date. The value is always a "YYYY-MM-DD" string (or null):
 * no `Date` objects and no time zones, so what the person picked is exactly
 * what the server receives. Replaces the browser's own date control, whose
 * format and behaviour differ by browser and locale.
 */
export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  {
    value,
    defaultValue = null,
    onValueChange,
    min,
    max,
    today,
    placeholder = "Select date",
    clearable = false,
    invalid = false,
    weekStartsOn = 0,
    disabled,
    onClick,
    ...props
  },
  ref,
) {
  const [date, setDate] = useControllableState<string | null>({
    value,
    defaultValue,
    onChange: onValueChange,
  });
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const valid = parseISODate(date) ? date : null;

  const choose = (iso: string | null) => {
    setDate(iso);
    setOpen(false);
    anchor?.focus({ preventScroll: true });
  };

  return (
    <Wrapper data-ui="date-picker">
      <Trigger
        {...props}
        ref={composeRefs(ref, setAnchor)}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        $empty={!valid}
        $invalid={invalid}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setOpen((o) => !o);
        }}
      >
        <Value>{valid ? formatDisplay(valid) : placeholder}</Value>
        <TrailingIcon size={16} />
      </Trigger>

      <Popover open={open && !disabled} onOpenChange={setOpen} anchor={anchor} width={288}>
        <Calendar
          value={valid}
          today={today}
          min={min}
          max={max}
          weekStartsOn={weekStartsOn}
          autoFocus
          onSelect={choose}
        />
        <Footer>
          <FooterButton type="button" disabled={isOutOfRange(today, min, max)} onClick={() => choose(today)}>
            Today
          </FooterButton>
          {clearable && (
            <FooterButton type="button" disabled={!valid} onClick={() => choose(null)}>
              Clear
            </FooterButton>
          )}
        </Footer>
      </Popover>
    </Wrapper>
  );
});
