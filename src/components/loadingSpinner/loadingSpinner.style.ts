import type { CSSProperties } from "react";
import type { LoadingSpinnerSize } from "./loadingSpinner.types";

/* ─── Dot sizes (px) ─── */
const DOT_SIZES: Record<LoadingSpinnerSize, number> = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
};

const DOT_GAPS: Record<LoadingSpinnerSize, number> = {
  xs: 4,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 8,
};

/* ─── Inline spinner sizes (px) ─── */
const INLINE_SIZES: Record<LoadingSpinnerSize, number> = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
};

/* ─── Style builders ─── */

export function getDotsContainerStyle(size: LoadingSpinnerSize): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 0",
  };
}

export function getDotsRowStyle(size: LoadingSpinnerSize): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: `${DOT_GAPS[size]}px`,
  };
}

export function getDotStyle(
  size: LoadingSpinnerSize,
  index: number,
): CSSProperties {
  const px = DOT_SIZES[size];
  return {
    width: px,
    height: px,
    borderRadius: "50%",
    backgroundColor: "var(--primary)",
    opacity: 0.6,
    animation: "bounce-dot 1.4s ease-in-out infinite",
    animationDelay: `${index * 0.16}s`,
  };
}

export const DOTS_LABEL: CSSProperties = {
  marginTop: "0.75rem",
  fontSize: "0.75rem",
  fontWeight: 500,
  letterSpacing: "0.025em",
  color: "var(--muted-foreground)",
};

/* ─── Inline spinner ─── */

export function getInlineSpinnerStyle(size: LoadingSpinnerSize): CSSProperties {
  const px = INLINE_SIZES[size];
  return {
    width: px,
    height: px,
    animation: "spin 1s linear infinite",
    flexShrink: 0,
  };
}

export const INLINE_LABEL_WRAPPER: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
};

export const INLINE_LABEL_TEXT: CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--muted-foreground)",
};
