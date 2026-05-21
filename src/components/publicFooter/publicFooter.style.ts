import { CSSProperties } from "react";

type PublicFooterThemeVars = CSSProperties &
  Record<`--public-footer-${string}`, string>;

export const publicFooterThemeVars = (
  isDarkMode: boolean,
): PublicFooterThemeVars =>
  ({
    "--public-footer-bg": isDarkMode
      ? "radial-gradient(circle at 14% 12%, rgba(37, 99, 235, 0.3), transparent 24rem), linear-gradient(135deg, #07111f 0%, #0b1b36 62%, #150c18 120%)"
      : "radial-gradient(circle at 14% 12%, rgba(37, 99, 235, 0.14), transparent 24rem), linear-gradient(135deg, #ffffff 0%, #eef5ff 62%, #fef2f2 120%)",
    "--public-footer-fg": isDarkMode ? "#dbeafe" : "#07111f",
    "--public-footer-title": isDarkMode ? "#F8FAFC" : "#091324",
    "--public-footer-muted": isDarkMode ? "#9fb0ca" : "#4b5d74",
    "--public-footer-soft": isDarkMode ? "#7d8da6" : "#64748b",
    "--public-footer-grid": isDarkMode
      ? "rgba(255, 255, 255, 0.045)"
      : "rgba(15, 23, 42, 0.045)",
    "--public-footer-border": isDarkMode
      ? "rgba(255, 255, 255, 0.09)"
      : "rgba(15, 23, 42, 0.09)",
    // success / status pill colors
    "--public-footer-success-fg": isDarkMode ? "#bbf7d0" : "#14532d",
    "--public-footer-success-bg": isDarkMode
      ? "rgba(34, 197, 94, 0.12)"
      : "rgba(34, 197, 94, 0.1)",
    "--public-footer-success-border": isDarkMode
      ? "rgba(34, 197, 94, 0.22)"
      : "rgba(34, 197, 94, 0.18)",
  }) as PublicFooterThemeVars;

export const footer: CSSProperties = {
  position: "relative",
  flexShrink: 0,
  overflow: "hidden",
  color: "var(--public-footer-fg)",
  background: "var(--public-footer-bg)",
  borderTop: "1px solid var(--public-footer-border)",
  transition: "background 0.3s ease, color 0.3s ease",
};

export const gridOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "linear-gradient(var(--public-footer-grid) 1px, transparent 1px), linear-gradient(90deg, var(--public-footer-grid) 1px, transparent 1px)",
  backgroundSize: "58px 58px",
  maskImage: "linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent)",
  pointerEvents: "none",
};

export const container: CSSProperties = {
  position: "relative",
  width: "calc(100% - clamp(2rem, 5vw, 8rem))",
  maxWidth: "1600px",
  margin: "0 auto",
  padding: "clamp(3rem, 6vw, 5rem) 0 2rem",
};

export const topGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(min(100%, 24rem), 1.2fr) repeat(3, minmax(10rem, 0.8fr))",
  gap: "clamp(1.8rem, 4vw, 3rem)",
};

export const brandPanel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "1rem",
};

export const brandRow: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.75rem",
};

export const brandLogo: CSSProperties = {
  width: "220px",
  height: "auto",
  objectFit: "contain",
  flexShrink: 0,
};

export const brandTitle: CSSProperties = {
  color: "var(--public-footer-title)",
  fontSize: "1.6rem",
  fontWeight: 900,
  letterSpacing: "-0.06em",
};

export const brandText: CSSProperties = {
  maxWidth: "25rem",
  margin: 0,
  color: "var(--public-footer-muted)",
  fontSize: "0.98rem",
  lineHeight: 1.75,
  fontWeight: 500,
};

export const contactButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.55rem",
  minHeight: "2.9rem",
  padding: "0 1.05rem",
  borderRadius: "999px",
  color: "#ffffff",
  background: "linear-gradient(135deg, #2563eb, #dc2626)",
  boxShadow: "0 18px 40px rgba(37, 99, 235, 0.22)",
  fontSize: "0.9rem",
  fontWeight: 900,
  textDecoration: "none",
};

export const group: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.85rem",
};

export const groupTitle: CSSProperties = {
  margin: 0,
  color: "var(--public-footer-title)",
  fontSize: "0.88rem",
  fontWeight: 900,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

export const linkList: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
  margin: 0,
  padding: 0,
  listStyle: "none",
};

export const linkText: CSSProperties = {
  color: "var(--public-footer-muted)",
  fontSize: "0.94rem",
  fontWeight: 600,
};

export const contactLabel: CSSProperties = {
  display: "block",
  color: "var(--public-footer-soft)",
  fontSize: "0.72rem",
  fontWeight: 900,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

export const contactValue: CSSProperties = {
  display: "block",
  marginTop: "0.15rem",
  color: "var(--public-footer-fg)",
  fontSize: "0.94rem",
  fontWeight: 700,
  lineHeight: 1.45,
};

export const bottomBar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  marginTop: "clamp(2.5rem, 6vw, 4rem)",
  paddingTop: "1.4rem",
  borderTop: "1px solid var(--public-footer-border)",
};

export const copyright: CSSProperties = {
  margin: 0,
  color: "var(--public-footer-soft)",
  fontSize: "0.86rem",
  fontWeight: 650,
};

export const statusPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.65rem 0.82rem",
  borderRadius: "999px",
  color: "var(--public-footer-success-fg)",
  background: "var(--public-footer-success-bg)",
  border: "1px solid var(--public-footer-success-border)",
  fontSize: "0.8rem",
  fontWeight: 900,
};

export const statusDot: CSSProperties = {
  width: "0.5rem",
  height: "0.5rem",
  borderRadius: "999px",
  background: "#22c55e",
  boxShadow: "0 0 0 7px rgba(34, 197, 94, 0.12)",
};

export const responsiveTopGrid = (isCompact: boolean): CSSProperties =>
  isCompact
    ? {
        ...topGrid,
        gridTemplateColumns: "1fr",
      }
    : topGrid;
