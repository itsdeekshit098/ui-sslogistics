import { CSSProperties } from "react";

export const formSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  marginTop: "1.5rem",
};

export const fieldGroup: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

export const requiredStar: CSSProperties = {
  color: "var(--destructive)",
  marginLeft: "0.125rem",
};

export const fieldError: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--destructive)",
  marginTop: "0.125rem",
};

export const errorBanner: CSSProperties = {
  padding: "0.75rem",
  borderRadius: "var(--input-radius, 0.5rem)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  backgroundColor: "rgba(239, 68, 68, 0.05)",
  fontSize: "0.875rem",
  color: "#dc2626",
};
