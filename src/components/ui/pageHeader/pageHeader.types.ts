import type { ReactNode } from "react";

export interface PageHeaderPrimaryAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  /** Shown as a tooltip (desktop) or tap bubble (phone) while disabled. */
  disabledReason?: string;
  /** Applied to the desktop button; the phone floating button gets `${testId}-fab`. */
  testId?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Rendered inline next to the title, e.g. a status Badge. */
  badge?: ReactNode;
  /** Renders a "← label" link above the title, for detail pages. */
  backHref?: string;
  backLabel?: string;
  /** Right-aligned action buttons. */
  actions?: ReactNode;
  /**
   * The page's main "create" action. A normal button beside `actions` on
   * desktop; a floating pill above the bottom nav on phones.
   */
  primaryAction?: PageHeaderPrimaryAction;
  className?: string;
}
