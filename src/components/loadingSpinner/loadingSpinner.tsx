"use client";

import React from "react";
import type { LoadingSpinnerProps } from "./loadingSpinner.types";
import {
  getDotsContainerStyle,
  getDotsRowStyle,
  getDotStyle,
  DOTS_LABEL,
  getInlineSpinnerStyle,
} from "./loadingSpinner.style";

/**
 * Unified loading component.
 *
 * - **Inline** (buttons, etc.): renders a minimal spinning arc.
 * - **Centered** (content areas): renders animated bouncing-dots.
 *
 * Usage:
 *   - Inline in buttons:  `<LoadingSpinner size="sm" className="mr-2" />`
 *   - Centered in cards:  `<LoadingSpinner size="md" centered label="Loading..." />`
 *   - Full-section:       `<LoadingSpinner size="lg" centered />`
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "sm",
  label,
  centered = false,
  className,
}) => {
  // ── Inline spinner (buttons, small indicators) ──
  if (!centered && !label) {
    return (
      <svg
        style={getInlineSpinnerStyle(size)}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          style={{ opacity: 0.2 }}
        />
        <path
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          style={{ opacity: 0.8 }}
        />
      </svg>
    );
  }

  // ── Centered / label mode: bouncing dots ──
  return (
    <div style={getDotsContainerStyle()} className={className}>
      <div style={getDotsRowStyle(size)}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={getDotStyle(size, i)} />
        ))}
      </div>
      {label && <span style={DOTS_LABEL}>{label}</span>}
    </div>
  );
};

export default LoadingSpinner;
