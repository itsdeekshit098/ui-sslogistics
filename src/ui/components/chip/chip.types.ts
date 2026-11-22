import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Tone } from "../../styles/tone";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  tone?: Tone;
  /** How it is drawn: a soft tint, an outline, or a solid fill. */
  variant?: "subtle" | "outline" | "solid";
  size?: "sm" | "md";
  /** For a chip that toggles (a filter): shows it as selected. */
  selected?: boolean;
  /** Adds a remove button that calls this. */
  onRemove?: () => void;
  /** Label for the remove button (default "Remove"). */
  removeLabel?: string;
}
