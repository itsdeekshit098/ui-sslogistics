import type { HTMLAttributes } from "react";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "info"
  | "outline"
  // Tinted surfaces for status inside dense tables: a column of solid badges
  // reads as noise; a soft tint carries the same meaning more quietly.
  | "success-subtle"
  | "warning-subtle"
  | "destructive-subtle"
  | "info-subtle";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  /** Leading status dot in the badge's own colour, instead of coloured text alone. */
  dot?: boolean;
}
