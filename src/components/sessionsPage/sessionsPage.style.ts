import type { CSSProperties } from "react";

/* ─── Page Layout ─── */

export const pageContainer: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
};

export const headerRow: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

export const pageTitle: CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: "var(--foreground)",
};

export const pageDescription: CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--muted-foreground)",
};

/* ─── Table ─── */

export const tableWrapper: CSSProperties = {
  borderRadius: "var(--card-radius, 0.625rem)",
  border: "1px solid var(--border)",
  backgroundColor: "var(--card)",
  overflow: "hidden",
};

export const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.875rem",
};

export const th: CSSProperties = {
  padding: "0.75rem 1rem",
  textAlign: "left",
  fontWeight: 600,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--muted-foreground)",
  backgroundColor: "var(--muted)",
  borderBottom: "1px solid var(--border)",
};

export const td: CSSProperties = {
  padding: "0.75rem 1rem",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

export const emailCell: CSSProperties = {
  fontWeight: 500,
  color: "var(--foreground)",
};

export const timeCell: CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--muted-foreground)",
};

/* ─── Badges ─── */

const baseBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.125rem 0.5rem",
  borderRadius: "9999px",
  fontSize: "0.6875rem",
  fontWeight: 600,
  textTransform: "capitalize",
  letterSpacing: "0.02em",
};

export const roleBadgeAdmin: CSSProperties = {
  ...baseBadge,
  backgroundColor: "rgba(59, 130, 246, 0.12)",
  color: "rgb(59, 130, 246)",
};

export const roleBadgeStaff: CSSProperties = {
  ...baseBadge,
  backgroundColor: "rgba(16, 185, 129, 0.12)",
  color: "rgb(16, 185, 129)",
};

export const roleBadgeDriver: CSSProperties = {
  ...baseBadge,
  backgroundColor: "rgba(245, 158, 11, 0.12)",
  color: "rgb(245, 158, 11)",
};

export const roleBadgeDefault: CSSProperties = {
  ...baseBadge,
  backgroundColor: "var(--muted)",
  color: "var(--muted-foreground)",
};

export const statusActive: CSSProperties = {
  ...baseBadge,
  backgroundColor: "rgba(16, 185, 129, 0.12)",
  color: "rgb(16, 185, 129)",
};

export const statusBanned: CSSProperties = {
  ...baseBadge,
  backgroundColor: "rgba(239, 68, 68, 0.12)",
  color: "rgb(239, 68, 68)",
};

/* ─── Action Button ─── */

export const actionBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  padding: "0.375rem 0.75rem",
  borderRadius: "0.375rem",
  fontSize: "0.75rem",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  transition: "all 0.15s ease",
};

export const banBtn: CSSProperties = {
  ...actionBtn,
  borderColor: "rgba(239, 68, 68, 0.3)",
  color: "rgb(239, 68, 68)",
};

export const unbanBtn: CSSProperties = {
  ...actionBtn,
  borderColor: "rgba(16, 185, 129, 0.3)",
  color: "rgb(16, 185, 129)",
};

/* ─── Responsive Card (mobile) ─── */

export const mobileCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  padding: "1rem",
  borderRadius: "var(--card-radius, 0.625rem)",
  border: "1px solid var(--border)",
  backgroundColor: "var(--card)",
};

export const mobileCardRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

export const mobileLabel: CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--muted-foreground)",
};

export const mobileValue: CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--foreground)",
};

/* ─── Session Details (expandable row) ─── */

export const sessionRow: CSSProperties = {
  backgroundColor: "var(--muted)",
};

export const sessionCell: CSSProperties = {
  padding: "0.75rem 1rem",
  borderBottom: "1px solid var(--border)",
};

export const sessionGrid: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

export const sessionChip: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--border)",
  backgroundColor: "var(--background)",
  fontSize: "0.75rem",
};

export const sessionChipLabel: CSSProperties = {
  fontWeight: 600,
  color: "var(--foreground)",
};

export const sessionChipMeta: CSSProperties = {
  color: "var(--muted-foreground)",
  fontSize: "0.6875rem",
};

export const revokeBtn: CSSProperties = {
  ...actionBtn,
  borderColor: "rgba(245, 158, 11, 0.3)",
  color: "rgb(245, 158, 11)",
};

export const expandBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  padding: "0.25rem 0.5rem",
  borderRadius: "0.375rem",
  fontSize: "0.6875rem",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--border)",
  backgroundColor: "transparent",
  color: "var(--muted-foreground)",
  transition: "all 0.15s ease",
};

export const actionsCell: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.375rem",
  flexWrap: "wrap",
};

/* ─── Pagination ─── */

export const paginationContainer: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
  marginTop: "2rem",
  padding: "1rem",
};

export const paginationButton: CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.875rem",
  fontWeight: 500,
  border: "1px solid var(--border)",
  borderRadius: "var(--input-radius, 0.375rem)",
  backgroundColor: "var(--background)",
  cursor: "pointer",
  transition: "all 0.15s ease",
};

export const paginationInfo: CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--muted-foreground)",
};

/* ─── Reset Password ─── */

export const resetPasswordBtn: CSSProperties = {
  ...actionBtn,
  borderColor: "rgba(99, 102, 241, 0.3)",
  color: "rgb(99, 102, 241)",
};

export const passwordInputWrapper: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.375rem",
  width: "100%",
};

export const passwordInputLabel: CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--foreground)",
};

export const passwordInput: CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.75rem",
  fontSize: "0.875rem",
  borderRadius: "var(--input-radius, 0.375rem)",
  border: "1px solid var(--border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  outline: "none",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

export const passwordHint: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--muted-foreground)",
  marginTop: "0.125rem",
};
