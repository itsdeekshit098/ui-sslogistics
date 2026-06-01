import { CSSProperties } from "react";

/**
 * Shared form style tokens used across modal forms (repairModal, partModal, etc.)
 * Import from this file instead of re-defining these per component.
 */

// ─── Layout ───

export const formSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  marginTop: "1rem",
};

export const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "1rem",
};

export const formRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "1rem",
};

export const formCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  flex: "1 1 200px",
};

export const fieldGroup: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

export const modalBodyPadding: CSSProperties = {
  padding: "1.5rem",
};

// ─── Labels ───

export const fieldLabel: CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 500,
};

export const requiredStar: CSSProperties = {
  color: "#ef4444",
  marginLeft: "0.125rem",
};

// ─── Errors ───

export const fieldError: CSSProperties = {
  fontSize: "0.75rem",
  color: "#ef4444",
  marginTop: "0.125rem",
};

export const inputError: CSSProperties = {
  borderColor: "#ef4444",
};

export const errorBanner: CSSProperties = {
  padding: "0.75rem",
  borderRadius: "var(--input-radius, 0.5rem)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  backgroundColor: "rgba(239, 68, 68, 0.05)",
  fontSize: "0.875rem",
  color: "#dc2626",
};

export const errorBannerWithMargin: CSSProperties = {
  ...errorBanner,
  marginTop: "1rem",
};

// ─── Inputs ───

export const readOnlyInput: CSSProperties = {
  opacity: 0.7,
  cursor: "default",
};

export const textareaStyle: CSSProperties = {
  minHeight: "80px",
  resize: "vertical" as const,
};

export const warrantyInputRow: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
};

export const warrantyInputFlex: CSSProperties = {
  flex: 1,
};

export const selectTriggerStyle: CSSProperties = {
  flex: 1,
  minWidth: "120px",
};

// ─── Typeahead footers ───

export const addVendorFooterBtn: CSSProperties = {
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
  textAlign: "center" as const,
};

// ─── Icons ───

export const saveIconStyle: CSSProperties = {
  marginRight: "0.5rem",
};

// ─── Read-only display ───

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
  opacity: 0.6,
  cursor: "not-allowed",
};
