import { ReactNode } from "react";

export interface FilterDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Called when the drawer requests to close (backdrop click, X button, or Close button) */
  onClose: () => void;
  /** Called when the user clicks "Apply Filters" */
  onApply: () => void;
  /** The filter form fields rendered inside the drawer body */
  children: ReactNode;
  /** Optional custom title — defaults to "Filters" */
  title?: string;
}
