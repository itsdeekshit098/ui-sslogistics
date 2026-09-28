import { ReactNode } from "react";

export interface BottomSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Called on backdrop tap, Escape, or the close button */
  onClose: () => void;
  /** Optional heading shown beside the close button */
  title?: ReactNode;
  children: ReactNode;
  /** Extra classes for the sheet panel */
  className?: string;
}
