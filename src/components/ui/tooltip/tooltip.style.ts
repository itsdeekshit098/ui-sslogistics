import { CSSProperties } from "react";

export const tooltipWrapper: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  maxWidth: "100%",
};

export const tooltipPortal: CSSProperties = {
  position: "fixed",
  zIndex: "var(--z-popover)",
  backgroundColor: "var(--foreground)",
  color: "var(--background)",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.375rem",
  fontSize: "0.75rem",
  fontWeight: 500,
  maxWidth: "250px",
  whiteSpace: "normal",
  wordWrap: "break-word",
  pointerEvents: "none",
  boxShadow:
    "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  opacity: 0,
  transition: "opacity 0.2s ease-in-out, transform 0.2s ease-in-out",
  transform: "translateY(4px)",
};
