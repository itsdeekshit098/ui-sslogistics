import { CSSProperties } from "react";

/* ─── Summary Strip ─── */

export const summaryStrip: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "0.75rem",
  padding: "1rem",
  borderRadius: "var(--card-radius, 0.625rem)",
  border: "1px solid var(--border)",
  backgroundColor: "var(--card)",
};

export const summaryCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  padding: "0.75rem",
  borderRadius: "0.5rem",
  backgroundColor: "var(--background)",
};

export const summaryLabel: CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--muted-foreground)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export const summaryValue: CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
};

export const overdueValue: CSSProperties = {
  color: "#dc2626",
};

/* ─── Filter trigger badge ─── */

export const activeFilterBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.25rem",
  height: "1.25rem",
  borderRadius: "9999px",
  backgroundColor: "var(--primary)",
  color: "var(--primary-foreground)",
  fontSize: "0.6875rem",
  fontWeight: 700,
  marginLeft: "0.375rem",
};

/* ─── Status badges ─── */

export const statusBadgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "9999px",
  padding: "0.25rem 0.5rem",
  fontSize: "0.75rem",
  fontWeight: 500,
  whiteSpace: "nowrap",
};

export const statusConfirmed: CSSProperties = {
  backgroundColor: "rgba(37, 99, 235, 0.1)",
  color: "#2563eb",
};

export const statusCompleted: CSSProperties = {
  backgroundColor: "rgba(22, 163, 74, 0.1)",
  color: "#16a34a",
};

export const statusCancelled: CSSProperties = {
  backgroundColor: "rgba(107, 114, 128, 0.12)",
  color: "var(--muted-foreground)",
};

export const overdueBadge: CSSProperties = {
  ...statusBadgeBase,
  backgroundColor: "rgba(220, 38, 38, 0.1)",
  color: "#dc2626",
};

export const todayBadge: CSSProperties = {
  ...statusBadgeBase,
  backgroundColor: "rgba(217, 119, 6, 0.12)",
  color: "#d97706",
};

export const rowHighlightToday: CSSProperties = {
  backgroundColor: "rgba(217, 119, 6, 0.05)",
};

export const rowHighlightOverdue: CSSProperties = {
  backgroundColor: "rgba(220, 38, 38, 0.04)",
};
