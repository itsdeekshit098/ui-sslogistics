import type { ReactNode } from "react";
import type { Tone } from "../../styles/tone";

export interface ToastOptions {
  title?: ReactNode;
  description?: ReactNode;
  tone?: Tone;
  /** Milliseconds before it goes away. 0 keeps it until dismissed. Default 5000 (8000 for danger). */
  duration?: number;
  /** A single follow-up action, e.g. "Undo". */
  action?: { label: string; onClick: () => void };
}

export interface ToastApi {
  /** Shows a toast and returns its id. */
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export interface ToastRecord extends ToastOptions {
  id: string;
}
