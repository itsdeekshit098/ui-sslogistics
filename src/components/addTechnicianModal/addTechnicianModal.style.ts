import { CSSProperties } from "react";

export const overlay: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "1rem",
  paddingTop: "4rem",
  backdropFilter: "blur(4px)",
};

export const modalContainer: CSSProperties = {
  backgroundColor: "var(--background)",
  borderRadius: "0.75rem",
  width: "100%",
  maxWidth: "32rem", // smaller than repair modal (48rem)
  boxShadow:
    "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  maxHeight: "calc(100vh - 5rem)",
  border: "1px solid var(--border)",
  overflow: "hidden",
};

export const closeButton: CSSProperties = {
  position: "absolute",
  top: "1.25rem",
  right: "1.25rem",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0.25rem",
  color: "var(--muted-foreground)",
  opacity: 0.7,
  transition: "opacity 0.2s",
  zIndex: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const scrollArea: CSSProperties = {
  padding: "1.5rem",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
};

export const headerTitle: CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 600,
  margin: 0,
  color: "var(--foreground)",
};

export const headerDescription: CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--muted-foreground)",
  marginTop: "0.25rem",
};

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
  color: "#ef4444",
  marginLeft: "0.125rem",
};

export const fieldError: CSSProperties = {
  color: "#ef4444",
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

/* ─── Footer ─── */

export const footer: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
  marginTop: "1.5rem",
  paddingTop: "1.5rem",
  borderTop: "1px solid var(--border)",
};
