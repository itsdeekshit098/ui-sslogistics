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

// ─── Header row (Tailwind strings: needs hover/focus-visible/breakpoints,
// which CSSProperties objects can't express) ───────────────────────────────
export const headerWrapper =
  "flex min-w-0 items-center gap-3 border-b border-border p-3 pr-14 sm:px-5 sm:py-4 sm:pr-14";

export const headerTitle = "min-w-0 flex-1 truncate text-sm font-semibold sm:text-base";

export const downloadButtonWrapper = "shrink-0";

export const downloadLabel = "hidden sm:inline";

// ─── Content area ────────────────────────────────────────────────────────
export const contentArea: CSSProperties = {
  flex: 1,
  minHeight: "288px",
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
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "var(--muted)",
  color: "var(--muted-foreground)",
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

export const downloadLink =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
