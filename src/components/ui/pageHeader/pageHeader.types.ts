import type { ReactNode } from "react";

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
  className?: string;
}
