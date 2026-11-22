import type { InputProps } from "../input";

export interface NumberInputProps
  extends Omit<InputProps, "value" | "defaultValue" | "onChange" | "type" | "min" | "max" | "step"> {
  /** The number, or `null` when the field is empty. Omit for an uncontrolled field. */
  value?: number | null;
  defaultValue?: number | null;
  /** Called with every change: the number typed so far, or `null` while it is empty. */
  onValueChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  /** How much the up/down arrow keys change the value. Default 1. */
  step?: number;
  /** Decimal places allowed. 0 (the default) means whole numbers only. */
  maxDecimals?: number;
  /** Whether a minus sign is accepted. Default: only if `min` is below zero or unset. */
  allowNegative?: boolean;
}
