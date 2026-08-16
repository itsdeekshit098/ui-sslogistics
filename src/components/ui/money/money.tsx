import { cn } from "@/lib/utils";
import { formatCurrency, formatCurrencyPrecise } from "@/lib/format";
import type { MoneyProps } from "./money.types";

/**
 * The one place a rupee figure gets rendered, so every ledger/statement/
 * schedule column lines up on tabular-nums digits instead of drifting with
 * proportional glyph widths — the difference between reading as a
 * financial statement and reading as a data dump.
 */
export function Money({ value, precise, tone = "neutral", className }: MoneyProps) {
  return (
    <span
      className={cn(
        "tabular-nums",
        tone === "positive" && "text-success-subtle-foreground",
        tone === "negative" && "text-destructive",
        className,
      )}
    >
      {precise ? formatCurrencyPrecise(value) : formatCurrency(value)}
    </span>
  );
}
