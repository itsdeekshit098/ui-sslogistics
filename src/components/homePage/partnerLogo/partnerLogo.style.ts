import { CSSProperties } from "react";

export const logoFrame: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
};

export const logoImage: CSSProperties = {
  objectFit: "contain",
  objectPosition: "center",
  mixBlendMode: "multiply",
};

export const fallbackLogo: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  color: "#0f172a",
  fontSize: "1.35rem",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textAlign: "center",
  textTransform: "uppercase",
};
