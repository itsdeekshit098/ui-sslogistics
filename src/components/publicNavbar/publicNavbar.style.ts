import { CSSProperties } from "react";

type PublicNavbarThemeVars = CSSProperties &
  Record<`--public-nav-${string}`, string>;

export const publicNavbarThemeVars = (
  isDarkMode: boolean,
): PublicNavbarThemeVars =>
  ({
    "--public-nav-bg": isDarkMode
      ? "linear-gradient(90deg, rgba(7, 17, 31, 0.98), rgba(11, 27, 54, 0.96))"
      : "linear-gradient(90deg, rgba(255, 255, 255, 0.92), rgba(239, 246, 255, 0.86))",
    "--public-nav-border": isDarkMode
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(15, 23, 42, 0.08)",
    "--public-nav-shadow": isDarkMode
      ? "0 18px 45px rgba(7, 17, 31, 0.18)"
      : "0 16px 35px rgba(15, 23, 42, 0.08)",
    "--public-nav-brand": isDarkMode ? "#F8FAFC" : "#091324",
    "--public-nav-subtitle": isDarkMode ? "#93a4bd" : "#64748b",
    "--public-nav-pill-bg": isDarkMode
      ? "rgba(255, 255, 255, 0.055)"
      : "rgba(15, 23, 42, 0.04)",
    "--public-nav-pill-border": isDarkMode
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(15, 23, 42, 0.08)",
    "--public-nav-link": isDarkMode ? "#cbd5e1" : "#334155",
    "--public-nav-link-hover-bg": isDarkMode
      ? "rgba(255, 255, 255, 0.1)"
      : "rgba(37, 99, 235, 0.08)",
    "--public-nav-link-hover": isDarkMode ? "#ffffff" : "#0f4dd8",
  }) as PublicNavbarThemeVars;

export const header: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  flexShrink: 0,
  background: "var(--public-nav-bg)",
  borderBottom: "1px solid var(--public-nav-border)",
  boxShadow: "var(--public-nav-shadow)",
  backdropFilter: "blur(18px)",
  transition: "background 0.3s ease, border-color 0.3s ease",
};

export const container: CSSProperties = {
  width: "calc(100% - clamp(2rem, 5vw, 8rem))",
  maxWidth: "1600px",
  minHeight: "4.05rem",
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
};

export const brandLink: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.72rem",
  color: "#ffffff",
  textDecoration: "none",
};

export const brandMark: CSSProperties = {
  width: "2.35rem",
  height: "2.35rem",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "0.9rem",
  color: "#ffffff",
  background: "linear-gradient(135deg, #dc2626, #2563eb)",
  boxShadow: "0 14px 28px rgba(37, 99, 235, 0.22)",
  fontSize: "0.82rem",
  fontWeight: 900,
  letterSpacing: "-0.05em",
};

export const brandTextGroup: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.05rem",
};

export const brandTitle: CSSProperties = {
  color: "var(--public-nav-brand)",
  fontSize: "clamp(1.2rem, 2.4vw, 1.6rem)",
  fontWeight: 900,
  letterSpacing: "-0.06em",
};

export const brandSubtitle: CSSProperties = {
  color: "var(--public-nav-subtitle)",
  fontSize: "0.68rem",
  fontWeight: 800,
  letterSpacing: "0.13em",
  textTransform: "uppercase",
};

export const navLinks: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.35rem",
  padding: "0.35rem",
  borderRadius: "999px",
  background: "var(--public-nav-pill-bg)",
  border: "1px solid var(--public-nav-pill-border)",
};

export const navLink: CSSProperties = {
  padding: "0.62rem 0.85rem",
  borderRadius: "999px",
  color: "var(--public-nav-link)",
  fontSize: "0.82rem",
  fontWeight: 800,
  textDecoration: "none",
  transition: "color 0.2s ease, background 0.2s ease",
};

export const actions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.7rem",
};

export const portalLink: CSSProperties = {
  minHeight: "2.65rem",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.55rem",
  padding: "0 1rem",
  borderRadius: "0.85rem",
  color: "#06101f",
  background: "linear-gradient(135deg, #60a5fa, #2563eb)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  boxShadow: "0 14px 30px rgba(37, 99, 235, 0.28)",
  fontSize: "0.88rem",
  fontWeight: 900,
  textDecoration: "none",
};

export const portalLinkStyle = (isCompact: boolean): CSSProperties =>
  isCompact
    ? {
        ...portalLink,
        width: "2.65rem",
        padding: 0,
      }
    : portalLink;

export const portalText: CSSProperties = {
  display: "inline",
};

export const mobileHidden: CSSProperties = {
  display: "none",
};

export const desktopOnly = (isCompact: boolean): CSSProperties =>
  isCompact ? mobileHidden : navLinks;

export const brandSubtitleStyle = (isCompact: boolean): CSSProperties =>
  isCompact ? mobileHidden : brandSubtitle;

export const portalTextStyle = (isCompact: boolean): CSSProperties =>
  isCompact ? mobileHidden : portalText;
