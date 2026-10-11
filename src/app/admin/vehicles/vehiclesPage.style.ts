import type { CSSProperties } from "react";

/* ─── Active Filter Badge ─── */

export const activeFilterBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.25rem",
  height: "1.25rem",
  borderRadius: "var(--badge-radius)",
  backgroundColor: "var(--primary)",
  color: "var(--primary-foreground)",
  fontSize: "0.6875rem",
  fontWeight: 700,
  marginLeft: "0.375rem",
};

/* ─── Cell Icon Wrapper ─── */

export const cellRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.625rem",
};

export const cellLabel: CSSProperties = {
  fontWeight: 500,
};
