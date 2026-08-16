import { CSSProperties } from "react";

export const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: "var(--z-modal-overlay)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // Dark mode uses a darker overlay (0.75 vs 0.6) — dimming an already-dark
  // page by the light-mode amount barely reads as "this is now background."
  backgroundColor: "var(--overlay-background)",
  backdropFilter: "blur(4px)",
  padding: "var(--space-4)", // Ensure modal doesn't touch screen edges on small screens
};

export const modalContainer: CSSProperties = {
  position: "relative",
  zIndex: 50,
  width: "100%",
  maxWidth: "var(--modal-max-width, 512px)", // Can be overridden via style prop (32rem = 512px)
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
  borderRadius: "var(--modal-radius, 12px)", // 0.75rem = 12px
  border: "1px solid var(--border)",
  backgroundColor: "var(--card)",
  color: "var(--card-foreground)",
  boxShadow: "var(--modal-shadow)",
  overflow: "hidden",
  animation: "modalFadeIn 0.2s ease-out",
};

export const closeButton: CSSProperties = {
  position: "absolute",
  right: "var(--space-4)",
  top: "var(--space-4)",
  background: "none",
  border: "none",
  cursor: "pointer",
  opacity: 0.7,
  padding: "var(--space-1)",
  borderRadius: "var(--radius-xs)",
  color: "var(--foreground)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "opacity 0.15s",
  zIndex: 10,
};

export const header: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1-5)",
  padding: "var(--space-6) var(--space-6) var(--space-2)", // balanced bottom padding
  textAlign: "left",
  flexShrink: 0,
};

export const title: CSSProperties = {
  fontSize: "18px", // 1.125rem = 18px
  fontWeight: 600,
  letterSpacing: "-0.01em",
  lineHeight: "1",
  color: "var(--foreground)",
  margin: 0,
};

export const description: CSSProperties = {
  fontSize: "14px", // 0.875rem = 14px
  color: "var(--muted-foreground)",
  margin: 0,
};

export const body: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  minHeight: 0, // Required for flex child to shrink below content size
  padding: "var(--space-2) var(--space-6) var(--space-6)",
};

export const footer: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-end",
  gap: "var(--space-3)",
  padding: "var(--space-4) var(--space-3) var(--space-3)",
  flexShrink: 0,
};
