import { CSSProperties } from "react";

/**
 * repairModal.style.ts
 * Re-exports shared form tokens and defines repairModal-specific tokens.
 */
export {
  formSection,
  formGrid,
  formRow,
  fieldGroup,
  fieldLabel,
  requiredStar,
  fieldError,
  inputError,
  errorBanner,
  errorBannerWithMargin,
  addVendorFooterBtn as addVendorFooterButton,
  addVendorFooterBtn,
  modalBodyPadding,
  readOnlyBadge,
  readOnlyInput,
  saveIconStyle,
  warrantyInputRow,
  warrantyInputFlex,
  selectTriggerStyle,
  textareaStyle,
} from "@/styles/formTokens.style";

/* ─── Category Cards ─── */

export const categoryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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

/* ─── Typeahead Badges ─── */

export const inactiveBadge: CSSProperties = {
  fontSize: "0.7rem",
  backgroundColor: "var(--muted)",
  color: "var(--muted-foreground)",
  padding: "0.125rem 0.375rem",
  borderRadius: "0.25rem",
  marginLeft: "0.5rem",
};

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
  textAlign: "center" as const,
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

/* ─── Parts Toggle Section ─── */

export const partsToggle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.75rem 1rem",
  borderRadius: "var(--input-radius, 0.5rem)",
  border: "1px solid var(--border)",
  backgroundColor: "var(--muted)",
  cursor: "pointer",
  userSelect: "none",
  transition: "all 0.2s",
};

export const partsToggleActive: CSSProperties = {
  borderColor: "var(--primary)",
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  borderBottom: "none",
};

export const partsToggleLabel: CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 500,
};

export const partsToggleHint: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--muted-foreground)",
  marginTop: "0.125rem",
};

export const partsSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  marginTop: 0,
  padding: "1rem",
  border: "1px solid var(--primary)",
  borderTop: "none",
  borderBottomLeftRadius: "var(--input-radius, 0.5rem)",
  borderBottomRightRadius: "var(--input-radius, 0.5rem)",
  backgroundColor: "var(--card)",
};

export const partCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--input-radius, 0.5rem)",
  backgroundColor: "var(--background)",
  position: "relative",
};

export const partCardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

export const partCardTitle: CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--muted-foreground)",
};

export const partRemoveButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.5rem",
  height: "1.5rem",
  borderRadius: "50%",
  border: "none",
  backgroundColor: "transparent",
  color: "var(--muted-foreground)",
  cursor: "pointer",
  transition: "all 0.15s",
};

export const partFormGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0.75rem",
};

export const addPartButton: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.375rem",
  padding: "0.5rem",
  border: "1px dashed var(--border)",
  borderRadius: "var(--input-radius, 0.5rem)",
  backgroundColor: "transparent",
  color: "var(--primary)",
  fontSize: "0.8125rem",
  fontWeight: 500,
  cursor: "pointer",
  transition: "background-color 0.2s",
};
