/**
 * Design Tokens — Shared Tailwind class constants
 *
 * Central source of truth for reusable layout patterns across pages.
 * Import and re-export from feature-level style files to maintain
 * backward compatibility while eliminating duplication.
 */

/* ─── Page Layout ─── */
export const PAGE_CONTAINER = "container mx-auto space-y-6 md:space-y-8";
export const PAGE_HEADER_TITLE =
  "text-2xl md:text-3xl font-bold tracking-tight";
export const PAGE_HEADER_DESC =
  "text-sm md:text-base text-muted-foreground";

/* ─── Modal Layout ─── */
export const MODAL_CONTENT =
  "w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6";
export const MODAL_GRID = "grid grid-cols-1 sm:grid-cols-2 gap-4";
export const MODAL_LABEL_SPACE = "space-y-2";

/* ─── Feedback Patterns ─── */
export const ERROR_BANNER =
  "bg-destructive/10 text-destructive px-4 py-3 rounded-[var(--input-radius)] text-sm border border-destructive/20 flex justify-between items-center";
export const INFO_BANNER =
  "bg-muted/50 p-4 rounded-[var(--input-radius)] text-sm text-muted-foreground";
