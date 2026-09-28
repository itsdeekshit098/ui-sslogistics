import type { CSSProperties } from "react";

export const summaryStrip: CSSProperties = {
  display: "grid",
  // min(…, 50%) keeps two cards per row on phones instead of one 190px
  // card per full-width row; desktop still gets the 190px minimum.
  gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, calc(50% - 0.375rem)), 1fr))",
  gap: "0.75rem",
  width: "100%",
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
