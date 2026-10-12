import type { ReactNode } from "react";

export interface SegmentedControlItem {
  key: string;
  label: ReactNode;
  count?: number | string;
}

export interface SegmentedControlProps {
  items: SegmentedControlItem[];
  value: string;
  onValueChange: (key: string) => void;
  className?: string;
  idPrefix?: string;
  /** Locks every option, e.g. while a save is in flight. */
  disabled?: boolean;
}
