import { CSSProperties } from "react";

export const publicLayoutShell: CSSProperties = {
  display: "flex",
  width: "100%",
  height: "100dvh",
  flexDirection: "column",
  overflowX: "hidden",
  overflowY: "auto",
  background: "var(--background)",
};

export const publicLayoutMain: CSSProperties = {
  flex: "1 0 auto",
};
