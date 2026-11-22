import type { ReactNode } from "react";

export interface FloatingActionButtonProps {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  /**
   * Why the action is unavailable. Touch screens have no hover tooltip, so
   * tapping the (greyed) button shows this in a bubble instead.
   */
  disabledReason?: string;
  testId?: string;
  /**
   * Background colour for this button. Leave unset to use the accent from the
   * nearest AccentProvider (or the default primary colour).
   */
  accent?: string;
}
