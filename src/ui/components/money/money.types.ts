export type MoneyTone = "neutral" | "positive" | "negative";

export interface MoneyProps {
  value: number | null | undefined;
  /** Keeps paise — for interest figures where rounding to rupees would mislead. */
  precise?: boolean;
  /**
   * positive/negative color the figure (e.g. an advance held vs. an
   * overdue amount); explicit, not inferred from sign — amounts in this
   * schema are always stored positive with a separate direction field.
   */
  tone?: MoneyTone;
  className?: string;
}
