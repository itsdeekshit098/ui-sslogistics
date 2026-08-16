import type { ReactNode } from "react";

/**
 * neutral: default, no semantic charge (e.g. "Total Billed").
 * positive: a good outcome (e.g. "Advance Held").
 * warning: worth a glance, not yet urgent.
 * critical: demands attention now (e.g. overdue amounts) — the only tone
 * that colors the value itself, not just the icon chip.
 */
export type StatCardTone = "neutral" | "positive" | "warning" | "critical";

export interface StatCardProps {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  /** Small line under the value for extra context, e.g. "3 overdue". */
  subtext?: ReactNode;
  tone?: StatCardTone;
  /** Makes the card an interactive control, e.g. to apply it as a filter. */
  onClick?: () => void;
  className?: string;
  id?: string;
  /**
   * @deprecated use `tone` — kept for the call sites not yet migrated.
   * Overrides the icon chip's background when `tone` isn't set.
   */
  iconBgColor?: string;
  /** @deprecated use `tone` */
  iconColor?: string;
  /** @deprecated use `tone="critical"` (or "warning") */
  highlightColor?: string;
}
