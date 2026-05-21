import { CSSProperties } from "react";

/* ─── Filter Trigger Bar (search + filter button) ─── */

export const topBar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
  alignItems: "center",
  justifyContent: "space-between",
};

export const activeFilterBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.25rem",
  height: "1.25rem",
  borderRadius: "9999px",
  backgroundColor: "var(--primary)",
  color: "var(--primary-foreground)",
  fontSize: "0.6875rem",
  fontWeight: 700,
  marginLeft: "0.375rem",
};

/* ─── Loading Overlay ─── */

export const loadingOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255, 255, 255, 0.6)",
  borderRadius: "inherit",
  zIndex: 5,
  transition: "opacity 0.2s ease",
};

/* ─── Summary Strip ─── */

export const summaryStrip: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "0.75rem",
  padding: "1rem",
  borderRadius: "var(--card-radius, 0.625rem)",
  border: "1px solid var(--border)",
  backgroundColor: "var(--card)",
};

export const summaryCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  padding: "0.75rem",
  borderRadius: "0.5rem",
  backgroundColor: "var(--background)",
};

export const summaryLabel: CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--muted-foreground)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export const summaryValue: CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
};

export const profitPositive: CSSProperties = {
  color: "#16a34a",
};

export const profitNegative: CSSProperties = {
  color: "#dc2626",
};

export const profitNeutral: CSSProperties = {
  color: "var(--muted-foreground)",
};
