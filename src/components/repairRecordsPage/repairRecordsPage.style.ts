import type { CSSProperties } from "react";

export const summaryStrip: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "1rem",
  width: "100%",
};
/* ─── Filter Drawer ─── */

export const drawerBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 40,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  backdropFilter: "blur(2px)",
  transition: "opacity 0.25s ease",
};

export const drawerContainer: CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  zIndex: 41,
  width: "100%",
  maxWidth: "22rem",
  display: "flex",
  flexDirection: "column",
  backgroundColor: "var(--card)",
  borderLeft: "1px solid var(--border)",
  boxShadow: "-8px 0 30px rgba(0, 0, 0, 0.12)",
  transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
};

export const drawerHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1.25rem 1.5rem",
  borderBottom: "1px solid var(--border)",
};

export const drawerTitle: CSSProperties = {
  fontSize: "1.125rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
};

export const drawerBody: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

export const drawerFieldGroup: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

export const drawerFieldLabel: CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--foreground)",
};

export const drawerSelect: CSSProperties = {
  width: "100%",
  height: "2.5rem",
  padding: "0 2.25rem 0 0.75rem",
  fontSize: "0.875rem",
  lineHeight: "1.25rem",
  color: "var(--foreground)",
  backgroundColor: "var(--background)",
  border: "1px solid var(--border)",
  borderRadius: "var(--input-radius, 0.5rem)",
  outline: "none",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.625rem center",
  backgroundSize: "1rem",
  cursor: "pointer",
  transition: "border-color 0.15s ease",
};

export const drawerFooter: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  padding: "1rem 1.5rem",
  borderTop: "1px solid var(--border)",
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

/* ─── Category Cell ─── */

export const categoryCellRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.625rem",
};

export const categoryCellLabel: CSSProperties = {
  textTransform: "capitalize",
  fontWeight: 500,
};

export const categoryCellIconBadge = (category: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.75rem",
  height: "1.75rem",
  borderRadius: "0.5rem",
  backgroundColor:
    category === "electrical"
      ? "rgba(56, 189, 248, 0.12)"
      : "rgba(249, 115, 22, 0.12)",
  flexShrink: 0,
});

export const categoryCellIconBadgeSm = (category: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.5rem",
  height: "1.5rem",
  borderRadius: "0.375rem",
  backgroundColor:
    category === "electrical"
      ? "rgba(56, 189, 248, 0.12)"
      : "rgba(249, 115, 22, 0.12)",
  flexShrink: 0,
});

export const categoryMobileCellRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  fontSize: "0.75rem",
  color: "var(--muted-foreground)",
  textTransform: "capitalize",
};

export const electricalIconStyle: CSSProperties = { color: "#38bdf8", fill: "#38bdf8" };
export const mechanicalIconStyle: CSSProperties = { color: "#f97316", fill: "#f97316" };
