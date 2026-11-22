import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

export type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The visual style. `default` is the primary filled action. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Render the single child element (a link, say) in place of a `<button>`,
   * giving it this button's look and props.
   */
  asChild?: boolean;
}
