import type { ComponentIcon } from "@/components/ui/icon";

export interface EmptyStateProps {
  /** Icon displayed above the title */
  icon?: ComponentIcon;
  /** Main title — e.g. "No Vehicles Found" */
  title: string;
  /** Supporting text explaining why it's empty */
  description?: string;
  /** Label for the primary action button */
  actionLabel?: string;
  /** Callback for the primary action button */
  onAction?: () => void;
  /** Whether the action button should be disabled */
  actionDisabled?: boolean;
  /** Additional CSS classes on the root wrapper */
  className?: string;
}
