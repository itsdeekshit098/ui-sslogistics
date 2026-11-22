import type { ReactNode } from "react";

export interface LoadingOverlayProps {
  /** True while the content underneath is being refetched. */
  busy: boolean;
  /** Text shown beside the spinner. */
  label?: string;
  children: ReactNode;
  className?: string;
}
