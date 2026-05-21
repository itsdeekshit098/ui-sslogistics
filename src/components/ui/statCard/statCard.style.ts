import type { CSSProperties } from "react";

export const summaryCard = (highlightColor?: string): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "1.25rem",
  borderRadius: "0.75rem",
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  position: "relative",
  overflow: "hidden",
  transition: "transform 0.15s ease, border-color 0.15s ease",
  ...(highlightColor && {
    borderLeft: `3px solid ${highlightColor}`,
  }),
});

export const summaryCardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.625rem",
};

export const cardIconWrapper = (bgColor: string, color: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2rem",
  height: "2rem",
  borderRadius: "50%",
  backgroundColor: bgColor,
  color: color,
  flexShrink: 0,
});

export const summaryLabel: CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "var(--muted-foreground)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export const summaryValue: CSSProperties = {
  fontSize: "1.625rem",
  fontWeight: 700,
  color: "var(--foreground)",
  letterSpacing: "-0.02em",
  lineHeight: "1.2",
};
