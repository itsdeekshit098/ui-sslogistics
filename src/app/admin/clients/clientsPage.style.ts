import type { CSSProperties } from "react";

/* ─── Cell Icon Wrapper ─── */

export const cellRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

export const cellIconBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.5rem",
  height: "1.5rem",
  borderRadius: "0.375rem",
  backgroundColor: "rgba(59, 130, 246, 0.10)",
  flexShrink: 0,
};

export const cellIconColor = "#60a5fa";
