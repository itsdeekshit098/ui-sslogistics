import { CSSProperties } from "react";

export const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(4px)",
  padding: "16px", // Ensure modal doesn't touch screen edges on small screens
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
  right: "16px", // 1rem = 16px
  top: "16px", // 1rem = 16px
  background: "none",
  border: "none",
  cursor: "pointer",
  opacity: 0.7,
  padding: "4px", // 0.25rem = 4px
  borderRadius: "4px", // 0.25rem = 4px
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
  gap: "6px", // 0.375rem = 6px
  padding: "24px 24px 8px", // 1.5rem = 24px, 0.5rem = 8px (balanced bottom padding)
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
};

export const footer: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-end",
  gap: "12px", // 0.75rem = 12px
  padding: "16px 12px 12px", // 1rem = 16px, 1.5rem = 24px
  flexShrink: 0,
};
