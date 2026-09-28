import { CSSProperties } from "react";

export const pageContainer: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
  // Padding comes from the className (md:p-6) instead — on phones the admin
  // <main> already pads the page, and doubling it squeezed the cards.
};

export const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "1rem",
};

export const title: CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
};

export const filtersRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "wrap",
};

export const activeFilterBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "1.25rem",
  height: "1.25rem",
  borderRadius: "9999px",
  fontSize: "0.625rem",
  fontWeight: 600,
  backgroundColor: "var(--primary)",
  color: "var(--primary-foreground)",
  marginLeft: "0.375rem",
  padding: "0.125rem 0.375rem",
};

export const statusBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.25rem 0.625rem",
  borderRadius: "9999px",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "capitalize",
};

export const statusActive: CSSProperties = {
  backgroundColor: "rgba(34, 197, 94, 0.1)",
  color: "#16a34a",
};

export const statusExpiringSoon: CSSProperties = {
  backgroundColor: "rgba(245, 158, 11, 0.1)",
  color: "#d97706",
};

export const statusExpired: CSSProperties = {
  backgroundColor: "rgba(239, 68, 68, 0.1)",
  color: "#dc2626",
};

export const tableContainer: CSSProperties = {
  overflowX: "auto",
};

export const emptyContainer: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "3rem",
  textAlign: "center",
  color: "var(--muted-foreground)",
  gap: "0.5rem",
};

export const cardGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1rem",
};

export const warrantyCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  padding: "1rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--card-radius, 0.625rem)",
  backgroundColor: "var(--card)",
};

export const cardPartName: CSSProperties = {
  fontSize: "0.9375rem",
  fontWeight: 600,
};

export const cardDetail: CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--muted-foreground)",
};

export const cardVehicle: CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 500,
};

export const searchRow: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  alignItems: "center",
};

export const loadingContainer: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "3rem",
};

export const spinner: CSSProperties = {
  width: "2rem",
  height: "2rem",
  border: "3px solid var(--border)",
  borderTopColor: "var(--primary)",
  borderRadius: "50%",
  animation: "spin 0.6s linear infinite",
};

export const notesCell: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "normal",
  maxWidth: "200px",
};
