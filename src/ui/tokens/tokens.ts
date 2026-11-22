/**
 * Typed references to the CSS custom properties defined in `tokens.css`.
 *
 * Components never write a raw colour, radius or spacing value: they read it
 * from here, so light/dark mode and the phone overrides keep working with no
 * JavaScript theme. Each value is a `var(--name)` string; a test
 * (test/ui/tokens.test.ts) fails if one of them is missing from tokens.css.
 */

const v = (name: string) => `var(--${name})` as const;

export const color = {
  background: v("background"),
  foreground: v("foreground"),
  primary: v("primary"),
  primaryForeground: v("primary-foreground"),
  secondary: v("secondary"),
  secondaryForeground: v("secondary-foreground"),
  muted: v("muted"),
  mutedForeground: v("muted-foreground"),
  placeholderForeground: v("placeholder-foreground"),
  accent: v("accent"),
  accentForeground: v("accent-foreground"),
  card: v("card"),
  cardForeground: v("card-foreground"),
  popover: v("popover"),
  popoverForeground: v("popover-foreground"),
  brand: v("brand"),
  brandForeground: v("brand-foreground"),
  border: v("border"),
  input: v("input"),
  ring: v("ring"),
  overlay: v("overlay-background"),
  skeleton: v("skeleton"),
  popupBorder: v("popup-border"),
  // Meaning colours. `subtle` is the soft background + readable text pair.
  destructive: v("destructive"),
  destructiveForeground: v("destructive-foreground"),
  destructiveSubtle: v("destructive-subtle"),
  destructiveSubtleForeground: v("destructive-subtle-foreground"),
  success: v("success"),
  successForeground: v("success-foreground"),
  successSubtle: v("success-subtle"),
  successSubtleForeground: v("success-subtle-foreground"),
  warning: v("warning"),
  warningForeground: v("warning-foreground"),
  warningSubtle: v("warning-subtle"),
  warningSubtleForeground: v("warning-subtle-foreground"),
  info: v("info"),
  infoForeground: v("info-foreground"),
  infoSubtle: v("info-subtle"),
  infoSubtleForeground: v("info-subtle-foreground"),
} as const;

export const space = {
  0: v("space-0"),
  0.5: v("space-0-5"),
  1: v("space-1"),
  1.5: v("space-1-5"),
  2: v("space-2"),
  2.5: v("space-2-5"),
  3: v("space-3"),
  3.5: v("space-3-5"),
  4: v("space-4"),
  5: v("space-5"),
  6: v("space-6"),
  7: v("space-7"),
  8: v("space-8"),
  9: v("space-9"),
  10: v("space-10"),
  11: v("space-11"),
  12: v("space-12"),
  14: v("space-14"),
  16: v("space-16"),
} as const;

export const radius = {
  base: v("radius"),
  card: v("card-radius"),
  modal: v("modal-radius"),
  input: v("input-radius"),
  badge: v("badge-radius"),
  // Smaller steps, derived from the base radius.
  xs: "calc(var(--radius) - 4px)",
  sm: "calc(var(--radius) - 2px)",
  // Phone shapes that mirror the Flutter app.
  phoneCard: v("m-radius-card"),
  phoneTile: v("m-radius-tile"),
  phoneSheet: v("m-radius-sheet"),
  phoneControl: v("m-radius-control"),
} as const;

export const shadow = {
  xs: v("shadow-xs"),
  sm: v("shadow-sm"),
  md: v("shadow-md"),
  lg: v("shadow-lg"),
  xl: v("shadow-xl"),
  card: v("card-shadow"),
  modal: v("modal-shadow"),
  phoneCard: v("m-card-shadow"),
} as const;

export const zIndex = {
  popover: v("z-popover"),
  modalOverlay: v("z-modal-overlay"),
  modalNestedOverlay: v("z-modal-nested-overlay"),
} as const;

export const control = {
  heightSm: v("input-height-sm"),
  height: v("input-height"),
  heightLg: v("input-height-lg"),
} as const;

export const font = {
  sans: "var(--font-sans)",
  heading: "var(--font-heading)",
} as const;

/**
 * Static scales. Unlike colours these never change with the theme, so they are
 * plain values rather than CSS variables. They follow Tailwind's defaults so a
 * component converted from Tailwind keeps its exact size.
 */
export const fontSize = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
} as const;

/**
 * The line height that pairs with each `fontSize` step. These are ratios, not
 * fixed lengths, so they scale when a component overrides the font size (a
 * badge that drops to 11px on phones keeps its 4:3 line height). A rem value
 * here would look identical at the default size and break at every other.
 */
export const lineHeight = {
  xs: "calc(1 / 0.75)",
  sm: "calc(1.25 / 0.875)",
  base: "calc(1.5 / 1)",
  lg: "calc(1.75 / 1.125)",
  xl: "calc(1.75 / 1.25)",
  "2xl": "calc(2 / 1.5)",
  "3xl": "calc(2.25 / 1.875)",
  "4xl": "calc(2.5 / 2.25)",
} as const;

/** Standalone line heights (Tailwind's `leading-*`), for text with no size step. */
export const leading = {
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
} as const;

export const tracking = {
  tight: "-0.025em",
  normal: "0em",
  wide: "0.025em",
  wider: "0.05em",
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

export const motion = {
  duration: "150ms",
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

/** A theme colour at the given opacity, e.g. `mix(color.success, 20)`. */
export const mix = (token: string, percent: number) =>
  `color-mix(in oklab, ${token} ${percent}%, transparent)`;

/**
 * Stacking order for the library's layers. The modal overlay (50) and the
 * nested overlay sit above these, so a confirm dialog opened from a sheet
 * stacks on top of it.
 */
export const layer = {
  floatingButton: 20,
  sheetBackdrop: 40,
  sheet: 41,
} as const;

/** Fixed colours that are the same in every theme. */
export const palette = {
  white: "#fff",
  black: "#000",
} as const;

/** Every token above as its bare custom-property name, for the tokens test. */
export const tokenNames: string[] = [
  color,
  space,
  radius,
  shadow,
  zIndex,
  control,
].flatMap((group) =>
  Object.values(group)
    .filter((ref) => ref.startsWith("var(--"))
    .map((ref) => ref.slice("var(--".length, -1)),
);
