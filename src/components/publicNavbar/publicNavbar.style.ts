import { CSSProperties } from "react";

type PublicNavbarThemeVars = CSSProperties &
  Record<`--public-nav-${string}`, string>;

export const publicNavbarThemeVars = (
  isDarkMode: boolean,
): PublicNavbarThemeVars =>
  ({
    "--public-nav-bg": isDarkMode
      ? "rgba(10, 20, 38, 0.82)"
      : "rgba(255, 255, 255, 0.78)",
    "--public-nav-border": isDarkMode
      ? "rgba(148, 163, 184, 0.14)"
      : "rgba(15, 23, 42, 0.1)",
    "--public-nav-shadow": isDarkMode
      ? "0 18px 50px rgba(0, 0, 0, 0.28)"
      : "0 16px 40px rgba(15, 23, 42, 0.08)",
    "--public-nav-brand": isDarkMode ? "#F8FAFC" : "#091324",
    "--public-nav-divider": isDarkMode
      ? "rgba(148, 163, 184, 0.18)"
      : "rgba(15, 23, 42, 0.1)",
    "--public-nav-link": isDarkMode ? "#94a3b8" : "#475569",
    "--public-nav-link-hover": isDarkMode ? "#e2e8f0" : "#0f172a",
    "--public-nav-link-hover-bg": isDarkMode
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(37, 99, 235, 0.06)",
    "--public-nav-active-accent": "#6366f1",
  }) as PublicNavbarThemeVars;

// ─── Outer header (full-width bar for sticky positioning) ─────────────────

export const header: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  flexShrink: 0,
  padding: "0.65rem 0",
  transition: "background 0.3s ease",
};

// ─── Floating card container ──────────────────────────────────────────────

export const container: CSSProperties = {
  width: "calc(100% - clamp(1rem, 2vw, 2.5rem))",
  maxWidth: "1600px",
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  minHeight: "3.75rem",
  padding: "0 0.75rem",
  borderRadius: "0.5rem",
  background: "var(--public-nav-bg)",
  border: "1px solid var(--public-nav-border)",
  boxShadow: "var(--public-nav-shadow)",
  backdropFilter: "blur(22px)",
  WebkitBackdropFilter: "blur(22px)",
};

// ─── Brand ────────────────────────────────────────────────────────────────

export const brandLink: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.65rem",
  color: "#ffffff",
  textDecoration: "none",
  flexShrink: 0,
};

export const brandMark: CSSProperties = {
  width: "2.15rem",
  height: "2.15rem",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "0.7rem",
  color: "#ffffff",
  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
  boxShadow: "0 8px 20px rgba(99, 102, 241, 0.3)",
  fontSize: "0.78rem",
  fontWeight: 900,
  letterSpacing: "-0.05em",
};

export const brandTitle: CSSProperties = {
  color: "var(--public-nav-brand)",
  fontSize: "clamp(1.1rem, 2vw, 1.35rem)",
  fontWeight: 900,
  letterSpacing: "-0.04em",
  whiteSpace: "nowrap",
};

// ─── Vertical divider ────────────────────────────────────────────────────

export const divider: CSSProperties = {
  width: "1px",
  alignSelf: "stretch",
  margin: "0.65rem 0.6rem",
  background: "var(--public-nav-divider)",
  flexShrink: 0,
};

// ─── Nav links ────────────────────────────────────────────────────────────

export const navLinks: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.25rem",
  flex: "1 1 auto",
};

export const navLink: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.45rem",
  padding: "0.58rem 0.82rem",
  borderRadius: "0.6rem",
  color: "var(--public-nav-link)",
  fontSize: "0.86rem",
  fontWeight: 700,
  textDecoration: "none",
  whiteSpace: "nowrap",
  transition: "color 0.2s ease, background 0.2s ease",
};

export const navLinkActive: CSSProperties = {
  ...navLink,
  color: "var(--public-nav-active-accent)",
};

export const activeUnderline: CSSProperties = {
  position: "absolute",
  bottom: "0.1rem",
  left: "50%",
  transform: "translateX(-50%)",
  width: "1.25rem",
  height: "2px",
  borderRadius: "999px",
  background: "var(--public-nav-active-accent)",
};

// ─── Right actions ────────────────────────────────────────────────────────

export const actions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.6rem",
  flexShrink: 0,
};

export const portalLink: CSSProperties = {
  minHeight: "2.5rem",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  padding: "0 1rem",
  borderRadius: "0.5rem",
  color: "#ffffff",
  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
  border: "1px solid rgba(99, 102, 241, 0.3)",
  boxShadow: "0 8px 24px rgba(99, 102, 241, 0.28)",
  fontSize: "0.86rem",
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
  transition: "box-shadow 0.2s ease, transform 0.15s ease",
};

export const portalLinkStyle = (isCompact: boolean): CSSProperties =>
  isCompact
    ? {
      ...portalLink,
      width: "2.5rem",
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

export const portalTextStyle = (isCompact: boolean): CSSProperties =>
  isCompact ? mobileHidden : portalText;

export const dividerStyle = (isCompact: boolean): CSSProperties =>
  isCompact ? mobileHidden : divider;
