"use client";

import { formatCurrency, formatCurrencyPrecise } from "../../utils/formatCurrency";
import { StyledMoney } from "./money.styles";
import type { MoneyProps } from "./money.types";

/**
 * The one place a rupee figure gets rendered, so every ledger/statement/
 * schedule column lines up on tabular-nums digits instead of drifting with
 * proportional glyph widths — the difference between reading as a
 * financial statement and reading as a data dump.
 */
export function Money({ value, precise, tone = "neutral", className }: MoneyProps) {
  return (
    <StyledMoney data-ui="money" $tone={tone} className={className}>
      {precise ? formatCurrencyPrecise(value) : formatCurrency(value)}
    </StyledMoney>
  );
}
