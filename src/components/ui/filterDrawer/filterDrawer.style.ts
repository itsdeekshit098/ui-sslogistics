import { CSSProperties } from "react";

export const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 40,
  backgroundColor: "rgba(0, 0, 0, 0.4)",
  backdropFilter: "blur(2px)",
};

export const panel: CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  zIndex: 41,
  width: "100%",
  maxWidth: "22rem",
  display: "flex",
  flexDirection: "column",
  backgroundColor: "var(--card)",
  borderLeft: "1px solid var(--border)",
  borderTopLeftRadius: "1rem",
  borderBottomLeftRadius: "1rem",
  boxShadow: "-8px 0 30px rgba(0, 0, 0, 0.12)",
  overflow: "hidden",
};

export const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1.25rem 1.5rem",
  borderBottom: "1px solid var(--border)",
};

export const title: CSSProperties = {
  fontSize: "1.125rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
};

export const body: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "1.5rem",
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
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--foreground)",
};

export const footer: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  padding: "1rem 1.5rem",
  borderTop: "1px solid var(--border)",
};
