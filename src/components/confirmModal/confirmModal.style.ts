import { CSSProperties } from "react";

export const container: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "16px", // 1rem = 16px
  textAlign: "center",
};

export const iconWrapper: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px", // 0.75rem = 12px
  borderRadius: "9999px",
  backgroundColor: "rgba(239, 68, 68, 0.1)",
};

export const textContainer: CSSProperties = {};

export const title: CSSProperties = {
  fontSize: "18px", // 1.125rem = 18px
  fontWeight: 600,
  color: "var(--foreground)",
  margin: 0,
};

export const description: CSSProperties = {
  fontSize: "14px", // 0.875rem = 14px
  color: "var(--muted-foreground)",
  marginTop: "4px", // 0.25rem = 4px
};

export const actionWrapper: CSSProperties = {
  display: "flex",
  gap: "12px", // 0.75rem = 12px
  width: "100%",
};

export const actionButton: CSSProperties = {
  flex: 1,
};

export const errorBanner: CSSProperties = {
  width: "100%",
  backgroundColor: "rgba(239, 68, 68, 0.1)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  color: "#dc2626",
  fontSize: "12px", // 0.75rem = 12px
  padding: "10px 12px", // 0.625rem = 10px, 0.75rem = 12px
  borderRadius: "6px", // 0.375rem = 6px
};

export const modalContent: CSSProperties = {
  maxWidth: "448px", // 28rem = 448px
  padding: "24px", // 1.5rem = 24px
};
