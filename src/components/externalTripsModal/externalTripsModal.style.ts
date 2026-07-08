import { CSSProperties } from "react";

/* ─── Form ─── */

/* ─── Form ─── */

export const formSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  marginTop: "1.5rem",
};

export const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
  color: "var(--destructive)",
  marginLeft: "0.125rem",
};

export const fieldError: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--destructive)",
  marginTop: "0.125rem",
};

export const charCounter: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  marginTop: "0.125rem",
};

/* ─── Trip Type Cards ─── */

export const categoryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0.75rem",
};

export const categoryCardBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
  border: "2px solid var(--border)",
  borderRadius: "var(--card-radius, 0.625rem)",
  cursor: "pointer",
  transition: "all 0.2s",
  backgroundColor: "var(--card)",
  textAlign: "center",
};

export const categoryCardSelected: CSSProperties = {
  borderColor: "var(--primary)",
  boxShadow: "0 0 0 1px var(--primary)",
};

export const categoryCardDisabled: CSSProperties = {
  opacity: 0.6,
  cursor: "default",
};

export const categoryLabel: CSSProperties = {
  fontWeight: 600,
  fontSize: "0.9375rem",
};

/* ─── Cost Items ─── */

export const costSection: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--card-radius, 0.625rem)",
  padding: "1rem",
  backgroundColor: "var(--background)",
};

export const costSectionTitle: CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 600,
  marginBottom: "0.75rem",
  color: "var(--foreground)",
};

export const costRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "0.5rem",
  alignItems: "center",
  marginBottom: "0.5rem",
};

export const costPresetLabel: CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 500,
  padding: "0.5rem 0.75rem",
  borderRadius: "var(--input-radius, 0.5rem)",
  backgroundColor: "var(--muted)",
  color: "var(--foreground)",
  display: "flex",
  alignItems: "center",
  height: "2.25rem",
};

export const costTotalRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingTop: "0.75rem",
  marginTop: "0.75rem",
  borderTop: "1px solid var(--border)",
  fontWeight: 600,
  fontSize: "0.9375rem",
};

export const addCostButton: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
  padding: "0.375rem 0.75rem",
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--primary)",
  background: "none",
  border: "1px dashed var(--border)",
  borderRadius: "var(--input-radius, 0.5rem)",
  cursor: "pointer",
  transition: "all 0.2s",
  marginTop: "0.25rem",
};

export const removeCostButton: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0.25rem",
  color: "var(--muted-foreground)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  opacity: 0.7,
  transition: "opacity 0.15s",
};

/* ─── Typeahead Footer ─── */

export const addDriverButton: CSSProperties = {
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

/* ─── Read-only ─── */

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

/* ─── Read-only ─── */

/* ─── Error Banner ─── */

export const errorBanner: CSSProperties = {
  padding: "0.75rem",
  borderRadius: "var(--input-radius, 0.5rem)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  backgroundColor: "rgba(239, 68, 68, 0.05)",
  fontSize: "0.875rem",
  color: "#dc2626",
};
