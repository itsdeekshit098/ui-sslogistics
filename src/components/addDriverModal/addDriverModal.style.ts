import { CSSProperties } from "react";

export const formSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

export const fieldGroup: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

export const requiredStar: CSSProperties = {
  color: "var(--destructive)",
  marginLeft: "0.125rem",
};

export const fieldError: CSSProperties = {
  color: "var(--destructive)",
  fontSize: "0.75rem",
  marginTop: "0.25rem",
};

/* ─── Error Banner ─── */

export const errorBanner: CSSProperties = {
  backgroundColor: "#fef2f2",
  color: "#991b1b",
  padding: "0.75rem",
  borderRadius: "0.375rem",
  fontSize: "0.875rem",
  border: "1px solid #f87171",
};
