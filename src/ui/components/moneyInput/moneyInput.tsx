"use client";

import { forwardRef } from "react";
import { CurrencySymbol, Field, Wrapper } from "./moneyInput.styles";
import type { MoneyInputProps } from "./moneyInput.types";

/** The most one amount may be: a billion rupees, the ceiling the loan ledgers enforce. */
export const MAX_MONEY = 1_000_000_000;

/**
 * An amount of money in rupees. A NumberInput that takes whole rupees and at
 * most two decimal places (paise), never a negative, and nothing above
 * `max` (a billion by default), so a form can't be sent a figure the ledgers
 * would reject for being malformed.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { symbol = "₹", min = 0, max = MAX_MONEY, step = 1, className, ...props },
  ref,
) {
  return (
    <Wrapper data-ui="money-input" className={className}>
      <CurrencySymbol aria-hidden="true">{symbol}</CurrencySymbol>
      <Field {...props} ref={ref} min={min} max={max} step={step} maxDecimals={2} allowNegative={false} />
    </Wrapper>
  );
});
