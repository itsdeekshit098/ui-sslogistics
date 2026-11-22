import type { ButtonHTMLAttributes } from "react";
import type { ISODate } from "./datePicker.utils";

export interface DatePickerProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "defaultValue" | "onChange" | "type"> {
  /** The date as "YYYY-MM-DD", or null when empty. Omit for an uncontrolled picker. */
  value?: ISODate | null;
  defaultValue?: ISODate | null;
  onValueChange?: (value: ISODate | null) => void;
  min?: ISODate;
  max?: ISODate;
  /**
   * Today as "YYYY-MM-DD". Pass the business day (e.g. `todayInIndia()`); the
   * picker never reads the machine's clock for it. Used for the "Today"
   * shortcut and to mark today in the grid.
   */
  today: ISODate;
  placeholder?: string;
  /** Show a button that empties the field. */
  clearable?: boolean;
  invalid?: boolean;
  weekStartsOn?: 0 | 1;
}
