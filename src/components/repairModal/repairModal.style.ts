import { CSSProperties } from "react";

/* ─── Form Grid ─── */

export const formSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  marginTop: "1.5rem",
};

export const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "1rem",
};

export const fieldGroup: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

export const fieldLabel: CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 500,
};

export const requiredStar: CSSProperties = {
  color: "#ef4444",
  marginLeft: "0.125rem",
};

export const fieldError: CSSProperties = {
  fontSize: "0.75rem",
  color: "#ef4444",
  marginTop: "0.125rem",
};

/* ─── Category Cards ─── */

export const categoryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.75rem",
};

export const categoryCardBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1rem",
  border: "2px solid var(--border)",
  borderRadius: "var(--card-radius, 0.625rem)",
  cursor: "pointer",
  transition: "all 0.2s",
  backgroundColor: "var(--card)",
};

export const categoryCardSelected: CSSProperties = {
  borderColor: "var(--primary)",
  boxShadow: "0 0 0 1px var(--primary)",
};

export const categoryCardDisabled: CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

export const categoryLabel: CSSProperties = {
  fontWeight: 600,
  fontSize: "0.9375rem",
};

export const categoryHint: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--muted-foreground)",
  marginTop: "0.125rem",
};

/* ─── Issue Chips ─── */

export const issueGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: "0.5rem",
};

export const issueChipBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.625rem 0.75rem",
  borderRadius: "var(--input-radius, 0.5rem)",
  border: "1px solid var(--border)",
  fontSize: "0.8125rem",
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s",
  backgroundColor: "var(--card)",
  color: "var(--foreground)",
  userSelect: "none",
};

export const issueChipSelected: CSSProperties = {
  backgroundColor: "var(--primary)",
  color: "var(--primary-foreground)",
  borderColor: "var(--primary)",
};

/* ─── Custom Issue Input ─── */

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

/* ─── Typeahead Footer & Badges ─── */

export const addTechnicianButton: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  padding: "0.5rem",
  borderTop: "1px solid var(--border)",
  backgroundColor: "var(--background)",
  color: "var(--primary)",
  fontSize: "0.875rem",
  fontWeight: 500,
  cursor: "pointer",
  transition: "background-color 0.2s",
  border: "none",
  textAlign: "center",
};

export const inactiveBadge: CSSProperties = {
  fontSize: "0.7rem",
  backgroundColor: "var(--muted)",
  color: "var(--muted-foreground)",
  padding: "0.125rem 0.375rem",
  borderRadius: "0.25rem",
  marginLeft: "0.5rem",
};

/* ─── Read-only Info ─── */

export const readOnlyBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  padding: "0.5rem 0.75rem",
  borderRadius: "var(--input-radius, 0.5rem)",
  backgroundColor: "var(--muted)",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--foreground)",
};

/* ─── Status Toggle ─── */

export const statusSection: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.75rem 1rem",
  borderRadius: "var(--input-radius, 0.5rem)",
  border: "1px solid var(--border)",
  backgroundColor: "var(--muted)",
};

export const statusLabel: CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 500,
};

/* ─── Error Banner ─── */

export const errorBanner: CSSProperties = {
  padding: "0.75rem",
  borderRadius: "var(--input-radius, 0.5rem)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  backgroundColor: "rgba(239, 68, 68, 0.05)",
  fontSize: "0.875rem",
  color: "#dc2626",
};
