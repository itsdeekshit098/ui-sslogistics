import type { InputHTMLAttributes, ReactNode } from "react";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "onChange" | "checked" | "defaultChecked"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Neither checked nor unchecked: some of a group are selected. */
  indeterminate?: boolean;
  /** The text beside the box. Without it, give the checkbox an `aria-label`. */
  children?: ReactNode;
  size?: "sm" | "md";
}
