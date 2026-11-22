import type { ButtonHTMLAttributes } from "react";

export interface MonthPickerProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "defaultValue" | "onChange" | "type"> {
  /** The month as "YYYY-MM", or null when empty. Omit for an uncontrolled picker. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Earliest and latest selectable month, "YYYY-MM". */
  min?: string;
  max?: string;
  /** The current month "YYYY-MM": marked in the grid and used by the "This month" shortcut. */
  currentMonth: string;
  placeholder?: string;
  clearable?: boolean;
  invalid?: boolean;
}
