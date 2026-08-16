import { CSSProperties } from "react";

/* auto-fit/minmax gives the same 1-col-mobile / 2-col-desktop collapse as
   the Vehicle/Diesel modals' `grid-cols-1 sm:grid-cols-2`, without a
   Tailwind breakpoint — it responds to the modal's own width instead. */
export const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "1rem",
  marginTop: "0.5rem",
};

export const fieldGroup: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

export const fieldGroupFull: CSSProperties = {
  ...fieldGroup,
  gridColumn: "1 / -1",
};

export const requiredStar: CSSProperties = {
  color: "var(--destructive)",
  marginLeft: "0.125rem",
};

export const fieldError: CSSProperties = {
  color: "var(--destructive)",
  fontSize: "0.75rem",
  marginTop: "0.25rem",
};

export const charCount: CSSProperties = {
  alignSelf: "flex-end",
  fontSize: "0.75rem",
  color: "var(--muted-foreground)",
};

/* ─── Error Banner ─── */
/* Mirrors the Vehicle/Diesel modals' bg-destructive/10 + text-destructive
   banner, expressed with the theme's own --destructive var instead of a
   Tailwind opacity modifier, so light/dark both stay correct. */

export const errorBanner: CSSProperties = {
  marginTop: "1rem",
  backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)",
  color: "var(--destructive)",
  padding: "0.75rem 1rem",
  borderRadius: "var(--input-radius)",
  fontSize: "0.875rem",
  border: "1px solid color-mix(in srgb, var(--destructive) 20%, transparent)",
};
