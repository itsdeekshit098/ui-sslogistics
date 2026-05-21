import type { CSSProperties } from "react";

/* ─── Active Filter Badge ─── */

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

/* ─── Cell Icon Wrapper ─── */

export const cellRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.625rem",
};

export const cellIconBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.75rem",
  height: "1.75rem",
  borderRadius: "0.5rem",
  backgroundColor: "rgba(100, 116, 139, 0.10)",
  flexShrink: 0,
};

export const cellIconColor = "#94a3b8";

export const cellLabel: CSSProperties = {
  fontWeight: 500,
};
