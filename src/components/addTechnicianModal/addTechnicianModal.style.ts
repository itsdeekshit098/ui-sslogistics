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

export const fieldLabel: CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--foreground)",
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

/* ─── Specialization Chips ─── */

export const issueGrid: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

export const issueChipBase: CSSProperties = {
  padding: "0.375rem 0.75rem",
  borderRadius: "9999px",
  fontSize: "0.75rem",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid var(--border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  transition: "all 0.2s",
  userSelect: "none",
  display: "flex",
  alignItems: "center",
};

export const issueChipSelected: CSSProperties = {
  backgroundColor: "var(--primary)",
  color: "var(--primary-foreground)",
  borderColor: "var(--primary)",
};

export const customIssueRow: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  marginTop: "0.5rem",
};

export const customChipRemove: CSSProperties = {
  marginLeft: "0.375rem",
  cursor: "pointer",
  opacity: 0.7,
  display: "inline-flex",
  alignItems: "center",
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
