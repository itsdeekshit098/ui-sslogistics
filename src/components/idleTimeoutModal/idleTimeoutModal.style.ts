import type { CSSProperties } from "react";

export const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9998,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const card: CSSProperties = {
  position: "relative",
  zIndex: 9999,
  width: "100%",
  maxWidth: "26rem",
  margin: "0 1rem",
  padding: "2rem",
  borderRadius: "var(--card-radius, 0.75rem)",
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1.25rem",
  textAlign: "center",
};

export const iconCircle: CSSProperties = {
  width: "3.5rem",
  height: "3.5rem",
  borderRadius: "9999px",
  backgroundColor: "rgba(234, 179, 8, 0.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const title: CSSProperties = {
  fontSize: "1.125rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "var(--foreground)",
  margin: 0,
};

export const description: CSSProperties = {
  fontSize: "0.875rem",
  lineHeight: "1.5",
  color: "var(--muted-foreground)",
  margin: 0,
};

export const countdown: CSSProperties = {
  fontSize: "2rem",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  color: "var(--destructive, #dc2626)",
  lineHeight: 1,
};

export const buttonRow: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  width: "100%",
};
