export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface SpinnerProps {
  /** Size preset for the spinner */
  size?: SpinnerSize;
  /** Optional label displayed next to the spinner */
  label?: string;
  /** If true, renders centered in a padded container (for content areas) */
  centered?: boolean;
  /** Additional CSS classes */
  className?: string;
}
