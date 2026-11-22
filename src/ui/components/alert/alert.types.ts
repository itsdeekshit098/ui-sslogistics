import type { HTMLAttributes, ReactNode } from "react";
import type { Tone } from "../../styles/tone";

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** What the message means. Danger and warning are announced assertively. */
  tone?: Tone;
  /** A short bold heading above the message. */
  title?: ReactNode;
  /** Replaces the tone's default icon (pass `null` for none). */
  icon?: ReactNode;
  /** Shows a close button that calls this. */
  onDismiss?: () => void;
  /** Right-aligned controls, e.g. a "Retry" button. */
  action?: ReactNode;
  /**
   * Scrolls the message into view when it appears or its text changes. For an
   * error under a tall form that scrolls inside a dialog: without it the
   * message lands below the fold and pressing Save looks like it did nothing.
   */
  scrollIntoView?: boolean;
}
