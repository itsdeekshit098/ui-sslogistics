import { CSSProperties } from "react";

import { ContactOption, RouteStop } from "./homePage.types";

const deepShadow = "0 34px 90px rgba(5, 12, 25, 0.32)";
const glassBorder = "1px solid rgba(148, 163, 184, 0.22)";

type HomeThemeVars = CSSProperties & Record<`--home-${string}`, string>;

export const homeThemeVars = (isDarkMode: boolean): HomeThemeVars =>
  ({
    "--home-shell-bg": isDarkMode
      ? "radial-gradient(circle at 12% 8%, rgba(37, 99, 235, 0.22), transparent 30rem), radial-gradient(circle at 84% 18%, rgba(220, 38, 38, 0.16), transparent 27rem), linear-gradient(180deg, #07111f 0%, #0b1628 42%, #080d18 100%)"
      : "radial-gradient(circle at 12% 8%, rgba(37, 99, 235, 0.16), transparent 30rem), radial-gradient(circle at 84% 18%, rgba(220, 38, 38, 0.12), transparent 27rem), linear-gradient(180deg, #f8fbff 0%, #eef5ff 38%, #ffffff 100%)",
    "--home-foreground": isDarkMode ? "#f8fbff" : "#07111f",
    "--home-foreground-soft": isDarkMode ? "#dbeafe" : "#334155",
    "--home-muted": isDarkMode ? "#9fb0ca" : "#4b5d74",
    "--home-muted-soft": isDarkMode ? "#7184a3" : "#64748b",
    "--home-grid-line": isDarkMode
      ? "rgba(255, 255, 255, 0.055)"
      : "rgba(15, 23, 42, 0.045)",
    "--home-card-bg": isDarkMode
      ? "rgba(15, 28, 52, 0.78)"
      : "rgba(255, 255, 255, 0.8)",
    "--home-card-bg-strong": isDarkMode
      ? "rgba(18, 34, 62, 0.92)"
      : "rgba(255, 255, 255, 0.92)",
    "--home-partner-card-bg": isDarkMode
      ? "rgba(248, 250, 252, 0.94)"
      : "rgba(255, 255, 255, 0.94)",
    "--home-partner-card-border": isDarkMode
      ? "rgba(255, 255, 255, 0.2)"
      : "rgba(148, 163, 184, 0.22)",
    "--home-partner-band-bg": isDarkMode ? "#0d1a2e" : "#ffffff",
    "--home-partner-band-border": isDarkMode
      ? "rgba(148, 163, 184, 0.12)"
      : "rgba(148, 163, 184, 0.15)",
    "--home-partner-fade": isDarkMode ? "#0d1a2e" : "#ffffff",
    "--home-partner-header-color": isDarkMode ? "#94a3b8" : "#64748b",
    "--home-card-border": isDarkMode
      ? "rgba(148, 163, 184, 0.18)"
      : "rgba(148, 163, 184, 0.22)",
    "--home-card-shadow": isDarkMode
      ? "0 20px 60px rgba(0, 0, 0, 0.34)"
      : "0 18px 55px rgba(15, 23, 42, 0.08)",
    "--home-secondary-button-bg": isDarkMode
      ? "rgba(15, 28, 52, 0.82)"
      : "rgba(255, 255, 255, 0.74)",
    "--home-secondary-button-border": isDarkMode
      ? "rgba(148, 163, 184, 0.2)"
      : "rgba(15, 23, 42, 0.12)",
    "--home-operations-panel": isDarkMode
      ? "linear-gradient(145deg, rgba(15, 28, 52, 0.92), rgba(11, 22, 40, 0.82))"
      : "linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(239, 246, 255, 0.82))",
    "--home-operations-map": isDarkMode
      ? "radial-gradient(circle at 54% 45%, rgba(37, 99, 235, 0.28), transparent 14rem), linear-gradient(135deg, #0f1d35, #101827)"
      : "radial-gradient(circle at 54% 45%, rgba(37, 99, 235, 0.22), transparent 14rem), linear-gradient(135deg, #eaf2ff, #ffffff)",
    "--home-map-grid-line": isDarkMode
      ? "rgba(255, 255, 255, 0.06)"
      : "rgba(15, 23, 42, 0.052)",
    "--home-modal-bg": isDarkMode ? "#0f1d35" : "#ffffff",
    "--home-modal-close-bg": isDarkMode ? "#17243a" : "#f8fafc",
  }) as HomeThemeVars;

export const shell: CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  overflow: "hidden",
  background: "var(--home-shell-bg)",
  color: "var(--home-foreground)",
  isolation: "isolate",
  transition: "background 0.3s ease, color 0.3s ease",
};

export const backgroundGrid: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: -2,
  backgroundImage:
    "linear-gradient(var(--home-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--home-grid-line) 1px, transparent 1px)",
  backgroundSize: "56px 56px",
  maskImage: "linear-gradient(to bottom, rgba(0, 0, 0, 0.85), transparent 68%)",
  pointerEvents: "none",
};

export const auroraOne: CSSProperties = {
  position: "absolute",
  top: "-9rem",
  right: "-7rem",
  width: "25rem",
  height: "25rem",
  borderRadius: "999px",
  background: "rgba(37, 99, 235, 0.18)",
  filter: "blur(42px)",
  zIndex: -1,
};

export const auroraTwo: CSSProperties = {
  position: "absolute",
  top: "20rem",
  left: "-11rem",
  width: "28rem",
  height: "28rem",
  borderRadius: "999px",
  background: "rgba(220, 38, 38, 0.1)",
  filter: "blur(48px)",
  zIndex: -1,
};

export const section: CSSProperties = {
  position: "relative",
  padding: "clamp(4rem, 8vw, 7.5rem) 0",
};

export const heroSection: CSSProperties = {
  ...section,
  minHeight: "min(54rem, calc(100vh - 4rem))",
  display: "flex",
  alignItems: "center",
  paddingTop: "clamp(4rem, 8vw, 7rem)",
};

export const container: CSSProperties = {
  width: "calc(100% - clamp(1rem, 2vw, 2.5rem))",
  maxWidth: "1600px",
  margin: "0 auto",
};

export const heroGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 31rem), 1fr))",
  gap: "clamp(2.25rem, 5vw, 5rem)",
  alignItems: "center",
};

export const heroCopy: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "1.45rem",
  width: "min(100%, calc(100vw - 2rem))",
  minWidth: 0,
};

export const heroCopyCompact: CSSProperties = {
  ...heroCopy,
  maxWidth: "38rem",
  margin: "0 auto",
};

export const heroTitle: CSSProperties = {
  margin: 0,
  maxWidth: "100%",
  color: "var(--home-foreground)",
  fontSize: "clamp(3.25rem, 8.2vw, 7rem)",
  lineHeight: 0.9,
  letterSpacing: "-0.075em",
  fontWeight: 900,
};

export const heroTitleAccent: CSSProperties = {
  display: "inline-block",
  background: "linear-gradient(105deg, #0f4dd8 0%, #1d85ff 48%, #dc2626 100%)",
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
};

export const heroDescription: CSSProperties = {
  margin: 0,
  maxWidth: "100%",
  color: "var(--home-muted)",
  fontSize: "clamp(1rem, 2vw, 1.25rem)",
  lineHeight: 1.75,
  fontWeight: 500,
};

export const actions: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.9rem",
  alignItems: "center",
  marginTop: "0.35rem",
};

export const buttonBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "3.35rem",
  padding: "0 1.35rem",
  borderRadius: "999px",
  border: "0",
  fontSize: "0.98rem",
  fontWeight: 800,
  letterSpacing: "-0.015em",
  textDecoration: "none",
  cursor: "pointer",
  gap: "0.55rem",
  transition: "box-shadow 0.2s ease, background 0.2s ease",
};

export const primaryButton: CSSProperties = {
  ...buttonBase,
  color: "#ffffff",
  background: "linear-gradient(135deg, #0f4dd8 0%, #2563eb 48%, #dc2626 120%)",
  boxShadow: "0 18px 38px rgba(37, 99, 235, 0.28)",
};

export const secondaryButton: CSSProperties = {
  ...buttonBase,
  color: "var(--home-foreground)",
  background: "var(--home-secondary-button-bg)",
  border: "1px solid var(--home-secondary-button-border)",
  boxShadow: "0 14px 35px rgba(15, 23, 42, 0.08)",
  backdropFilter: "blur(14px)",
};

export const metricsRow: CSSProperties = {
  display: "grid",
  width: "100%",
  maxWidth: "34rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))",
  gap: "0.8rem",
  marginTop: "1rem",
};

export const metricTile: CSSProperties = {
  padding: "1rem",
  borderRadius: "1.3rem",
  background: "var(--home-card-bg)",
  border: "1px solid var(--home-card-border)",
  boxShadow: "var(--home-card-shadow)",
  backdropFilter: "blur(16px)",
};

export const metricValue: CSSProperties = {
  display: "block",
  color: "var(--home-foreground)",
  fontSize: "clamp(1.3rem, 3vw, 2rem)",
  fontWeight: 900,
  letterSpacing: "-0.06em",
};

export const metricLabel: CSSProperties = {
  display: "block",
  marginTop: "0.18rem",
  color: "var(--home-muted-soft)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.08em",
  lineHeight: 1.35,
  textTransform: "uppercase",
};

export const heroVisual: CSSProperties = {
  position: "relative",
  width: "min(100%, calc(100vw - 2rem))",
  minHeight: "clamp(31rem, 54vw, 42rem)",
  minWidth: 0,
};

export const commandCenter: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  minHeight: "clamp(30rem, 52vw, 40rem)",
  borderRadius: "2.2rem",
  background:
    "linear-gradient(145deg, rgba(7, 17, 31, 0.98) 0%, rgba(12, 26, 51, 0.94) 48%, rgba(6, 15, 30, 0.98) 100%)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  boxShadow: deepShadow,
};

export const commandGlow: CSSProperties = {
  position: "absolute",
  inset: "-20% -15% auto auto",
  width: "22rem",
  height: "22rem",
  borderRadius: "999px",
  background: "rgba(37, 99, 235, 0.45)",
  filter: "blur(65px)",
};

export const commandHeader: CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "1.15rem 1.2rem",
  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
};

export const windowDots: CSSProperties = {
  display: "flex",
  gap: "0.45rem",
};

export const windowDot: CSSProperties = {
  width: "0.62rem",
  height: "0.62rem",
  borderRadius: "999px",
  background: "rgba(255, 255, 255, 0.32)",
};

export const windowDotRed: CSSProperties = {
  ...windowDot,
  background: "#ef4444",
};

export const windowDotAmber: CSSProperties = {
  ...windowDot,
  background: "#f59e0b",
};

export const windowDotGreen: CSSProperties = {
  ...windowDot,
  background: "#22c55e",
};

export const commandTitle: CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: "0.8rem",
  fontWeight: 900,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

export const commandStatus: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.45rem",
  color: "#bbf7d0",
  fontSize: "0.78rem",
  fontWeight: 800,
};

export const statusPulse: CSSProperties = {
  width: "0.55rem",
  height: "0.55rem",
  borderRadius: "999px",
  background: "#22c55e",
  boxShadow: "0 0 0 8px rgba(34, 197, 94, 0.14)",
};

export const mapCanvas: CSSProperties = {
  position: "absolute",
  inset: "4.2rem 1.2rem 8.5rem",
  overflow: "hidden",
  borderRadius: "1.55rem",
  background:
    "radial-gradient(circle at 40% 34%, rgba(37, 99, 235, 0.24), transparent 16rem), linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))",
  border: "1px solid rgba(255, 255, 255, 0.12)",
};

export const mapGrid: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px)",
  backgroundSize: "42px 42px",
  opacity: 0.75,
};

export const routeSvg: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

export const vehiclePill: CSSProperties = {
  position: "absolute",
  right: "8%",
  top: "14%",
  zIndex: 3,
  display: "inline-flex",
  alignItems: "center",
  gap: "0.55rem",
  padding: "0.75rem 0.9rem",
  borderRadius: "999px",
  color: "#ffffff",
  background: "rgba(255, 255, 255, 0.1)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  backdropFilter: "blur(16px)",
  boxShadow: "0 16px 40px rgba(0, 0, 0, 0.18)",
  fontSize: "0.78rem",
  fontWeight: 800,
};

export const stopCardBase: CSSProperties = {
  position: "absolute",
  zIndex: 3,
  minWidth: "9.75rem",
  padding: "0.82rem 0.9rem",
  borderRadius: "1.1rem",
  color: "#ffffff",
  background: "rgba(7, 17, 31, 0.72)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  boxShadow: "0 18px 45px rgba(0, 0, 0, 0.25)",
  backdropFilter: "blur(18px)",
};

export const stopLabel: CSSProperties = {
  display: "block",
  fontSize: "0.88rem",
  fontWeight: 900,
  letterSpacing: "-0.02em",
};

export const stopStatus: CSSProperties = {
  display: "block",
  marginTop: "0.2rem",
  color: "#cbd5e1",
  fontSize: "0.72rem",
  fontWeight: 700,
};

export const stopPin: CSSProperties = {
  position: "absolute",
  left: "0.8rem",
  top: "-0.36rem",
  width: "0.72rem",
  height: "0.72rem",
  borderRadius: "999px",
  background: "#38bdf8",
  boxShadow: "0 0 0 8px rgba(56, 189, 248, 0.14)",
};

export const commandFooter: CSSProperties = {
  position: "absolute",
  left: "1.2rem",
  right: "1.2rem",
  bottom: "1.2rem",
  zIndex: 4,
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "0.75rem",
};

export const commandStat: CSSProperties = {
  padding: "0.88rem",
  borderRadius: "1rem",
  background: "rgba(255, 255, 255, 0.1)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  backdropFilter: "blur(16px)",
};

export const commandStatValue: CSSProperties = {
  display: "block",
  color: "#ffffff",
  fontSize: "1rem",
  fontWeight: 900,
  letterSpacing: "-0.04em",
};

export const commandStatLabel: CSSProperties = {
  display: "block",
  marginTop: "0.2rem",
  color: "#93a4bd",
  fontSize: "0.68rem",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export const sectionHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 21rem), 1fr))",
  gap: "1.5rem",
  alignItems: "end",
  marginBottom: "clamp(2rem, 5vw, 3.75rem)",
};

export const sectionTitle: CSSProperties = {
  margin: 0,
  color: "var(--home-foreground)",
  fontSize: "clamp(2.25rem, 5vw, 4.4rem)",
  lineHeight: 0.98,
  letterSpacing: "-0.065em",
  fontWeight: 900,
};

export const sectionText: CSSProperties = {
  margin: 0,
  color: "var(--home-muted)",
  fontSize: "clamp(1rem, 2vw, 1.12rem)",
  lineHeight: 1.75,
  fontWeight: 500,
};

export const sectionTextOffset: CSSProperties = {
  ...sectionText,
  marginTop: "1.25rem",
};

export const serviceGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15.5rem), 1fr))",
  gap: "1rem",
};

export const serviceCardBase: CSSProperties = {
  minHeight: "18rem",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: "1.35rem",
  borderRadius: "1.6rem",
  background: "var(--home-card-bg)",
  border: "1px solid var(--home-card-border)",
  boxShadow: "var(--home-card-shadow)",
  backdropFilter: "blur(18px)",
};

export const serviceIcon: CSSProperties = {
  width: "3.25rem",
  height: "3.25rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "1.05rem",
};

export const serviceTitle: CSSProperties = {
  margin: "1.15rem 0 0",
  color: "var(--home-foreground)",
  fontSize: "1.25rem",
  fontWeight: 900,
  letterSpacing: "-0.035em",
};

export const serviceDescription: CSSProperties = {
  margin: "0.7rem 0 0",
  color: "var(--home-muted-soft)",
  fontSize: "0.96rem",
  lineHeight: 1.65,
  fontWeight: 500,
};

export const cardArrow: CSSProperties = {
  width: "2.4rem",
  height: "2.4rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  color: "var(--home-foreground)",
  background: "var(--home-card-bg-strong)",
  border: "1px solid var(--home-card-border)",
};

export const partnerBand: CSSProperties = {
  ...section,
  padding: "clamp(3.5rem, 7vw, 5.5rem) 0",
  overflow: "hidden",
  background: "var(--home-partner-band-bg)",
  borderTop: "1px solid var(--home-partner-band-border)",
  borderBottom: "1px solid var(--home-partner-band-border)",
};

export const partnerHeader: CSSProperties = {
  margin: "0 0 2.5rem",
  color: "var(--home-partner-header-color)",
  fontSize: "0.82rem",
  fontWeight: 800,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  textAlign: "center",
};

export const marqueeOuter: CSSProperties = {
  position: "relative",
  width: "100%",
  overflow: "hidden",
};

export const marqueeFadeLeft: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: 0,
  width: "min(8rem, 14vw)",
  zIndex: 2,
  background:
    "linear-gradient(90deg, var(--home-partner-fade) 0%, transparent 100%)",
  pointerEvents: "none",
};

export const marqueeFadeRight: CSSProperties = {
  ...marqueeFadeLeft,
  left: "auto",
  right: 0,
  background:
    "linear-gradient(270deg, var(--home-partner-fade) 0%, transparent 100%)",
};

export const marqueeTrack: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "clamp(3rem, 6vw, 5rem)",
  width: "max-content",
};

export const partnerCard: CSSProperties = {
  width: "20rem",
  height: "7rem",
  flexShrink: 0,
  position: "relative",
  opacity: 0.82,
  transition: "opacity 0.3s ease, box-shadow 0.3s ease",
  background: "var(--home-partner-card-bg)",
  border: "1px solid var(--home-partner-card-border)",
  borderRadius: "1.25rem",
  overflow: "hidden",
};

export const operationsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))",
  gap: "clamp(2rem, 5vw, 4.75rem)",
  alignItems: "center",
};

export const featureList: CSSProperties = {
  display: "grid",
  gap: "1rem",
  marginTop: "2.25rem",
};

export const featureItem: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "1rem",
  padding: "1rem",
  borderRadius: "1.35rem",
  background: "var(--home-card-bg)",
  border: "1px solid var(--home-card-border)",
  boxShadow: "var(--home-card-shadow)",
};

export const featureIcon: CSSProperties = {
  width: "3rem",
  height: "3rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "1rem",
  color: "#2563eb",
  background: "rgba(37, 99, 235, 0.1)",
};

export const featureLabel: CSSProperties = {
  display: "block",
  color: "#dc2626",
  fontSize: "0.73rem",
  fontWeight: 900,
  letterSpacing: "0.14em",
};

export const featureTitle: CSSProperties = {
  margin: "0.18rem 0 0",
  color: "var(--home-foreground)",
  fontSize: "1.1rem",
  fontWeight: 900,
  letterSpacing: "-0.03em",
};

export const featureDescription: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "var(--home-muted-soft)",
  fontSize: "0.94rem",
  lineHeight: 1.6,
};

export const operationsPanel: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  minHeight: "clamp(30rem, 48vw, 38rem)",
  borderRadius: "2rem",
  background: "var(--home-operations-panel)",
  border: "1px solid var(--home-card-border)",
  boxShadow: "var(--home-card-shadow)",
};

export const operationsMap: CSSProperties = {
  position: "absolute",
  inset: "1rem",
  overflow: "hidden",
  borderRadius: "1.45rem",
  background: "var(--home-operations-map)",
  border: glassBorder,
};

export const operationsMapGrid: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "linear-gradient(var(--home-map-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--home-map-grid-line) 1px, transparent 1px)",
  backgroundSize: "46px 46px",
  maskImage: "linear-gradient(to bottom, rgba(0, 0, 0, 0.78), transparent 84%)",
};

export const operationsRoad: CSSProperties = {
  position: "absolute",
  inset: "12% 9%",
  borderRadius: "999px",
  border: "2px dashed rgba(37, 99, 235, 0.34)",
  transform: "rotate(-16deg)",
};

export const operationsHub: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "46%",
  width: "9.5rem",
  height: "9.5rem",
  marginLeft: "-4.75rem",
  marginTop: "-4.75rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  borderRadius: "50%",
  color: "#ffffff",
  background: "linear-gradient(135deg, #0f4dd8, #2563eb)",
  boxShadow: "0 24px 60px rgba(37, 99, 235, 0.34)",
};

export const operationsHubText: CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 900,
  letterSpacing: "0.12em",
  lineHeight: 1.35,
  textTransform: "uppercase",
};

export const flowStack: CSSProperties = {
  position: "absolute",
  left: "1.7rem",
  right: "1.7rem",
  bottom: "1.7rem",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(8.8rem, 1fr))",
  gap: "0.8rem",
};

export const flowCard: CSSProperties = {
  padding: "1rem",
  borderRadius: "1.15rem",
  background: "var(--home-card-bg-strong)",
  border: "1px solid var(--home-card-border)",
  backdropFilter: "blur(14px)",
};

export const flowIcon: CSSProperties = {
  display: "inline-flex",
  color: "#2563eb",
};

export const flowTitle: CSSProperties = {
  margin: "0.55rem 0 0",
  color: "var(--home-foreground)",
  fontSize: "0.9rem",
  fontWeight: 900,
};

export const flowText: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--home-muted-soft)",
  fontSize: "0.76rem",
  lineHeight: 1.45,
  fontWeight: 650,
};

export const proofGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))",
  gap: "0.8rem",
  marginTop: "2rem",
};

export const proofItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.65rem",
  padding: "0.85rem 0.9rem",
  borderRadius: "999px",
  color: "var(--home-foreground-soft)",
  background: "var(--home-card-bg)",
  border: "1px solid var(--home-card-border)",
  fontSize: "0.88rem",
  fontWeight: 800,
};

export const proofDot: CSSProperties = {
  width: "0.5rem",
  height: "0.5rem",
  flexShrink: 0,
  borderRadius: "999px",
  background: "#dc2626",
};

export const ctaSection: CSSProperties = {
  ...section,
  paddingBottom: "clamp(5rem, 8vw, 8rem)",
};

export const ctaPanel: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  padding: "clamp(2rem, 6vw, 4.75rem)",
  borderRadius: "2.25rem",
  color: "#ffffff",
  background:
    "radial-gradient(circle at 18% 22%, rgba(96, 165, 250, 0.38), transparent 20rem), linear-gradient(135deg, #07111f 0%, #0b2552 58%, #dc2626 145%)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  boxShadow: deepShadow,
};

export const ctaTitle: CSSProperties = {
  margin: 0,
  maxWidth: "12ch",
  color: "#ffffff",
  fontSize: "clamp(2.5rem, 6vw, 5.3rem)",
  lineHeight: 0.96,
  letterSpacing: "-0.07em",
  fontWeight: 900,
};

export const ctaDescription: CSSProperties = {
  margin: "1.1rem 0 0",
  maxWidth: "40rem",
  color: "#dbeafe",
  fontSize: "clamp(1rem, 2vw, 1.18rem)",
  lineHeight: 1.7,
  fontWeight: 550,
};

export const ctaBottom: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "1rem",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginTop: "2.2rem",
};

export const ctaHighlightList: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.7rem",
};

export const ctaHighlight: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.72rem 0.85rem",
  borderRadius: "999px",
  color: "#eaf2ff",
  background: "rgba(255, 255, 255, 0.09)",
  border: "1px solid rgba(255, 255, 255, 0.13)",
  fontSize: "0.82rem",
  fontWeight: 800,
};

export const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
  background: "rgba(7, 17, 31, 0.58)",
  backdropFilter: "blur(14px)",
};

export const modalPanel: CSSProperties = {
  width: "min(100%, 24rem)",
  overflow: "hidden",
  borderRadius: "1.65rem",
  background: "var(--home-modal-bg)",
  border: "1px solid var(--home-card-border)",
  boxShadow: deepShadow,
};

export const modalHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "1.25rem 1.25rem 0.8rem",
};

export const modalTitle: CSSProperties = {
  margin: 0,
  color: "var(--home-foreground)",
  fontSize: "1.35rem",
  fontWeight: 900,
  letterSpacing: "-0.04em",
};

export const modalClose: CSSProperties = {
  width: "2.35rem",
  height: "2.35rem",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  border: "1px solid var(--home-card-border)",
  color: "var(--home-foreground)",
  background: "var(--home-modal-close-bg)",
  cursor: "pointer",
};

export const modalBody: CSSProperties = {
  display: "grid",
  gap: "0.8rem",
  padding: "0.6rem 1.25rem 1.25rem",
};

export const modalText: CSSProperties = {
  margin: "0 0 0.35rem",
  color: "var(--home-muted-soft)",
  fontSize: "0.94rem",
  lineHeight: 1.55,
};

export const serviceCardStyle = (accent: string): CSSProperties => ({
  ...serviceCardBase,
  background: `linear-gradient(180deg, ${accent}18, var(--home-card-bg) 48%)`,
});

export const iconFrameStyle = (accent: string): CSSProperties => ({
  ...serviceIcon,
  color: accent,
  background: `${accent}14`,
});

export const routeStopStyle = (stop: RouteStop): CSSProperties => ({
  ...stopCardBase,
  left: `clamp(0.75rem, ${stop.left}, calc(100% - 10.75rem))`,
  top: stop.top,
});

export const contactOptionStyle = (
  tone: ContactOption["tone"],
): CSSProperties => ({
  ...buttonBase,
  width: "100%",
  minHeight: "3.35rem",
  color: "#ffffff",
  background:
    tone === "whatsapp"
      ? "linear-gradient(135deg, #22c55e, #16a34a)"
      : "linear-gradient(135deg, #0f4dd8, #2563eb)",
});

// ─── Compact / Mobile Layout Style Overrides ──────────────────────────────

export const heroVisualCompact: CSSProperties = {
  ...heroVisual,
  width: "100%",
  maxWidth: "min(100%, 38rem)",
  minHeight: "clamp(20rem, 48vw, 26rem)",
  margin: "0 auto",
};

export const commandCenterCompact: CSSProperties = {
  ...commandCenter,
  minHeight: "clamp(20rem, 48vw, 26rem)",
  borderRadius: "1.5rem",
};

export const mapCanvasCompact: CSSProperties = {
  ...mapCanvas,
  inset: "3.2rem 0.75rem 6rem",
  borderRadius: "1.1rem",
};

export const commandFooterCompact: CSSProperties = {
  ...commandFooter,
  left: "0.75rem",
  right: "0.75rem",
  bottom: "0.75rem",
  gap: "0.5rem",
};

export const commandStatCompact: CSSProperties = {
  ...commandStat,
  padding: "0.5rem 0.35rem",
  borderRadius: "0.75rem",
};

export const commandStatValueCompact: CSSProperties = {
  ...commandStatValue,
  fontSize: "0.85rem",
};

export const commandStatLabelCompact: CSSProperties = {
  ...commandStatLabel,
  fontSize: "0.55rem",
  letterSpacing: "0.04em",
};

export const stopCardBaseCompact: CSSProperties = {
  ...stopCardBase,
  minWidth: "7.5rem",
  padding: "0.5rem 0.6rem",
  borderRadius: "0.8rem",
};

export const routeStopStyleCompact = (stop: RouteStop): CSSProperties => ({
  ...stopCardBaseCompact,
  left: `clamp(0.5rem, ${stop.left}, calc(100% - 8.25rem))`,
  top: stop.top,
});

export const stopLabelCompact: CSSProperties = {
  ...stopLabel,
  fontSize: "0.78rem",
};

export const stopStatusCompact: CSSProperties = {
  ...stopStatus,
  fontSize: "0.62rem",
};

export const vehiclePillCompact: CSSProperties = {
  ...vehiclePill,
  padding: "0.45rem 0.65rem",
  fontSize: "0.68rem",
  top: "10%",
  right: "4%",
};

export const operationsPanelCompact: CSSProperties = {
  ...operationsPanel,
  minHeight: "clamp(20rem, 45vw, 26rem)",
  borderRadius: "1.5rem",
};

export const operationsMapCompact: CSSProperties = {
  ...operationsMap,
  inset: "0.6rem",
  borderRadius: "1rem",
};

export const operationsHubCompact: CSSProperties = {
  ...operationsHub,
  width: "6.5rem",
  height: "6.5rem",
  marginLeft: "-3.25rem",
  marginTop: "-3.25rem",
};

export const operationsHubTextCompact: CSSProperties = {
  ...operationsHubText,
  fontSize: "0.65rem",
};

export const flowStackCompact: CSSProperties = {
  ...flowStack,
  left: "0.6rem",
  right: "0.6rem",
  bottom: "0.6rem",
  gap: "0.4rem",
};

export const flowCardCompact: CSSProperties = {
  ...flowCard,
  padding: "0.6rem 0.5rem",
  borderRadius: "0.8rem",
};

export const flowTitleCompact: CSSProperties = {
  ...flowTitle,
  fontSize: "0.75rem",
  marginTop: "0.3rem",
};

export const flowTextCompact: CSSProperties = {
  ...flowText,
  fontSize: "0.62rem",
  marginTop: "0.15rem",
};

