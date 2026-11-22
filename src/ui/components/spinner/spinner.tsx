"use client";

import { Arc, Centered, Dot, DotRow, Label } from "./spinner.styles";
import type { SpinnerProps } from "./spinner.types";

/**
 * Unified loading indicator.
 *
 * - **Inline** (buttons, etc.): a minimal spinning arc.
 * - **Centered** (content areas): animated bouncing dots, with an optional label.
 *
 * Usage:
 *   - Inline in buttons:  `<Spinner size="sm" />`
 *   - Centered in cards:  `<Spinner size="md" centered label="Loading..." />`
 *   - Full-section:       `<Spinner size="lg" centered />`
 */
export function Spinner({ size = "sm", label, centered = false, className }: SpinnerProps) {
  if (!centered && !label) {
    return (
      <Arc
        data-ui="spinner"
        $size={size}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.2" />
        <path
          fill="currentColor"
          opacity="0.8"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </Arc>
    );
  }

  return (
    <Centered data-ui="spinner" className={className}>
      <DotRow $size={size}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} $size={size} />
        ))}
      </DotRow>
      {label && <Label>{label}</Label>}
    </Centered>
  );
}
