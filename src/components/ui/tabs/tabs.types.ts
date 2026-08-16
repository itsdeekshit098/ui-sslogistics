import type { ReactNode } from "react";

export interface TabItem {
  /** Stable key used as the active value and in the panel's aria wiring. */
  key: string;
  label: string;
  icon?: ReactNode;
  /** Optional trailing count/badge, e.g. the number of rows behind the tab. */
  badge?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  /** id prefix for the generated tab/panel ids; set when two tab bars coexist. */
  idPrefix?: string;
}
