import { CSSProperties } from "react";

// ─── Outer wrapper ───────────────────────────────────────────────────────
export const previewContainer: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "90vw",
  maxWidth: "960px",
  height: "85vh",
  maxHeight: "85vh",
  overflow: "hidden",
};

// ─── Header row ──────────────────────────────────────────────────────────
export const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 56px 16px 20px", // 56px right padding prevents overlap with absolute close button
  borderBottom: "1px solid var(--border)",
  flexShrink: 0,
  gap: "12px",
};

export const headerTitle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "var(--foreground)",
  margin: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  flex: 1,
};

export const headerActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexShrink: 0,
};

// ─── Content area ────────────────────────────────────────────────────────
export const contentArea: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  backgroundColor: "var(--muted)",
  position: "relative",
};

export const iframe: CSSProperties = {
  width: "100%",
  height: "100%",
  border: "none",
};

export const previewImage: CSSProperties = {
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
};

// ─── Loading / Error states ──────────────────────────────────────────────
export const loadingContainer: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
  color: "var(--muted-foreground)",
  fontSize: "14px",
};

export const errorContainer: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  padding: "32px",
  color: "var(--muted-foreground)",
  fontSize: "14px",
  textAlign: "center",
};

// ─── Download button styling ─────────────────────────────────────────────
export const downloadLink: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 14px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--foreground)",
  backgroundColor: "transparent",
  border: "1px solid var(--border)",
  cursor: "pointer",
  textDecoration: "none",
  transition: "background-color 0.15s",
};
