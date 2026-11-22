import type { NumberInputProps } from "../numberInput";

export interface MoneyInputProps extends Omit<NumberInputProps, "maxDecimals" | "allowNegative"> {
  /** The currency symbol shown inside the field. Default "₹". */
  symbol?: string;
}
