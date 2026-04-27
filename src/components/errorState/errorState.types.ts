export interface ErrorStateProps {
  /** Main title — defaults to "Something went wrong" */
  title?: string;
  /** Supporting description — defaults to a generic message */
  description?: string;
  /** Callback for the retry button. If omitted, no retry button is shown. */
  onRetry?: () => void;
  /** Label for the retry button — defaults to "Try Again" */
  retryLabel?: string;
  /** Whether the retry action is currently in progress */
  retrying?: boolean;
  /** Additional CSS classes on the root wrapper */
  className?: string;
}
