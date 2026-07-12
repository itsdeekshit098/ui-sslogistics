import { CSSProperties } from "react";

export const errorBanner: CSSProperties = {
  padding: "0.75rem",
  borderRadius: "0.375rem",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  backgroundColor: "rgba(239, 68, 68, 0.05)",
  fontSize: "0.875rem",
  color: "#dc2626",
  marginTop: "1rem",
};

export const triggerButton: CSSProperties = {
  display: "flex",
  alignItems: "center",
  transition: "all 0.2s",
  cursor: "pointer",
  border: "none",
  background: "none",
  outline: "none",
};

export const desktopTrigger: CSSProperties = {
  gap: "0.5rem",
  padding: "0.5rem 1rem",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#334155", // slate-700
  backgroundColor: "white",
  border: "1px solid #e2e8f0", // slate-200
  borderRadius: "0.375rem",
  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
};

export const iconTrigger: CSSProperties = {
  justifyContent: "center",
  borderRadius: "0.5rem",
  padding: "0.625rem",
  color: "var(--muted-foreground)",
};

export const mobileTrigger: CSSProperties = {
  width: "100%",
  gap: "0.75rem",
  padding: "0.625rem 0.75rem",
  borderRadius: "0.5rem",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--muted-foreground)",
  justifyContent: "flex-start",
};

export const cancelBtn: CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#334155",
  border: "1px solid #e2e8f0",
  borderRadius: "0.375rem",
  backgroundColor: "#f1f5f9", // slate-100
  transition: "background-color 0.2s",
  cursor: "pointer",
};

export const confirmBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  padding: "0.5rem 1rem",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--destructive-foreground)",
  backgroundColor: "var(--destructive)",
  borderRadius: "0.375rem",
  border: "none",
  transition: "background-color 0.2s",
  cursor: "pointer",
  minWidth: "100px",
};
