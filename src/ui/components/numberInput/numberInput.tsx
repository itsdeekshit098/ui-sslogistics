"use client";

import { forwardRef, useEffect, useState, type KeyboardEvent } from "react";
import { Input } from "../input";
import { useControllableState } from "../../hooks/useControllableState";
import { clamp, formatNumber, isAcceptable, parseNumber, roundTo } from "./numberInput.utils";
import type { NumberInputProps } from "./numberInput.types";

/**
 * A field for a number. It is a text input underneath, because
 * `<input type="number">` accepts "1e20", reports "" for half-typed input and
 * scrolls its value away under the wheel. This one:
 *
 * - refuses anything that isn't a number under its rules (no exponent, no
 *   extra decimals, no minus sign unless allowed), leaving the field as it was;
 * - reports `null` for an empty field, never `NaN` or `0`;
 * - clamps to `min` / `max` when the field loses focus, and on the arrow keys.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    value,
    defaultValue = null,
    onValueChange,
    min,
    max,
    step = 1,
    maxDecimals = 0,
    allowNegative,
    onBlur,
    onKeyDown,
    ...props
  },
  ref,
) {
  const negativeOk = allowNegative ?? (min === undefined || min < 0);
  const rules = { maxDecimals, allowNegative: negativeOk };

  const [number, setNumber] = useControllableState<number | null>({
    value,
    defaultValue,
    onChange: onValueChange,
  });
  const [text, setText] = useState(() => formatNumber(number));

  // The parent changed the value from outside (not by typing): show it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText((current) => (parseNumber(current) === number ? current : formatNumber(number)));
  }, [number]);

  const commit = (next: string) => {
    setText(next);
    setNumber(parseNumber(next));
  };

  const adjust = (direction: 1 | -1) => {
    const base = number ?? (min !== undefined ? min - direction * step : 0);
    const next = clamp(roundTo(base + direction * step, maxDecimals), min, max);
    commit(formatNumber(next));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      adjust(event.key === "ArrowUp" ? 1 : -1);
    }
  };

  return (
    <Input
      data-ui="number-input"
      {...props}
      ref={ref}
      type="text"
      inputMode={maxDecimals > 0 ? "decimal" : "numeric"}
      autoComplete="off"
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        if (isAcceptable(next, rules)) commit(next);
      }}
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        onBlur?.(event);
        const parsed = parseNumber(text);
        if (parsed === null) {
          // A lone "-" or "." means nothing; clear it.
          if (text !== "") commit("");
          return;
        }
        const bounded = clamp(parsed, min, max);
        const normalised = formatNumber(bounded);
        if (normalised !== text) commit(normalised);
      }}
    />
  );
});
