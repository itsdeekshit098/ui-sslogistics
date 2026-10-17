export type LoadingSpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface LoadingSpinnerProps {
  /** Size preset for the spinner */
  size?: LoadingSpinnerSize;
  /** Optional label displayed next to the spinner */
  label?: string;
  /** If true, renders centered in a padded container (for content areas) */
  centered?: boolean;
  /** Additional CSS classes */
  className?: string;
}
