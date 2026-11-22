import type { HTMLAttributes, ReactNode } from "react";

/** What a FormField hands its control so label, hint and error are all wired up. */
export interface FormControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

export interface FormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label: ReactNode;
  /** Marks the field required: an asterisk on the label and `aria-required` on the control. */
  required?: boolean;
  /** Helper text under the control. */
  hint?: ReactNode;
  /** Error text under the control; also marks the control invalid. */
  error?: ReactNode;
  /**
   * The control. Pass a function to receive the props that tie it to the label,
   * hint and error (`<Input {...control} />`); pass an element when it has its
   * own `id`, and give that same id as `htmlFor`.
   */
  children: ReactNode | ((control: FormControlProps) => ReactNode);
  /** The control's id when `children` is an element rather than a function. */
  htmlFor?: string;
}
