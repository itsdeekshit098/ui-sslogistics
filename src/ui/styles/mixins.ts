import { css, type RuleSet } from "styled-components";
import { media } from "../tokens/media";
import type { Keyframes } from "styled-components";
import { color, fontSize, lineHeight, motion } from "../tokens/tokens";

/**
 * Font size plus its matching line height (Tailwind's `text-sm`, `text-xs`…).
 *
 * The line height is `var(--tw-leading, <ratio>)`, as in Tailwind: if the
 * element (or an ancestor) set a line height with `setLeading`, that wins, so
 * a size change later in the cascade (a phone rule) keeps the tighter leading.
 */
export const text = (step: keyof typeof fontSize) => css`
  font-size: ${fontSize[step]};
  line-height: var(--tw-leading, ${lineHeight[step]});
`;

/**
 * A line height that later `text()` rules defer to — Tailwind's
 * `leading-tight` / `-snug` / `-normal` / `-relaxed`. (Not `leading-none`:
 * that one sets only `line-height`, so a later size still brings its own.)
 */
export const setLeading = (value: number) => css`
  --tw-leading: ${value};
  line-height: ${value};
`;

/** Colour/background/border changes ease in over the standard duration. */
export const colorTransition = css`
  transition-property: color, background-color, border-color, outline-color,
    text-decoration-color, fill, stroke;
  transition-timing-function: ${motion.easing};
  transition-duration: ${motion.duration};
`;

/**
 * The keyboard focus ring: a 2px gap in the page colour, then a 2px ring.
 * Only the ring is drawn here; the caller decides which pseudo-class it is
 * attached to (`:focus` or `:focus-visible`).
 */
export const focusRing = css`
  outline-style: none;
  box-shadow:
    0 0 0 2px ${color.background},
    0 0 0 4px ${color.ring};
`;

/**
 * Hover styling only on devices that can hover. A touch screen reports a tap
 * as a hover that never ends, which leaves a button looking pressed.
 */
export const onHover = <P extends object = object>(rules: RuleSet<P>) => css<P>`
  @media (hover: hover) {
    &:hover {
      ${rules}
    }
  }
`;

/**
 * Rules for one media query. They stay in the `ui` layer like the rest of the
 * component's styles, so a caller's Tailwind class (`className="p-0"`,
 * `md:pt-4`) always wins over them. That is the rule for the whole library:
 * a caller's className beats the component's own styling.
 *
 * (Tailwind-era components behaved slightly differently, because a `sm:`
 * utility on the component outranked a plain utility from the caller. Call
 * sites that depended on that carry an explicit class instead.)
 */
export const onMedia = <P extends object = object>(query: string, rules: RuleSet<P>) => css<P>`
  @layer ui {
    ${query} {
      ${rules}
    }
  }
`;

/**
 * Rules a caller's classes must not change. Before a component was converted
 * these were inline `style` values, which beat every class; inline styles are
 * not allowed in the library, so this reproduces that priority: the rule sits
 * in the `utilities` layer with a doubled class (`&&`), which outranks any
 * single-class Tailwind utility whichever stylesheet loads last.
 */
export const locked = (rules: ReturnType<typeof css>) => css`
  @layer utilities {
    && {
      ${rules}
    }
  }
`;

/** Rules that only apply below 768px, where the phone layout takes over. */
export const onPhone = <P extends object = object>(rules: RuleSet<P>) => onMedia(media.phone, rules);

/** Rules for 768px and up. */
export const onDesktop = <P extends object = object>(rules: RuleSet<P>) => onMedia(media.desktop, rules);

/** Rules for 640px and up (Tailwind's `sm`). */
export const onSm = <P extends object = object>(rules: RuleSet<P>) => onMedia(media.sm, rules);

/** Play an enter/exit keyframe once, 150ms, holding its final frame. */
export const playOnce = (frames: Keyframes) => css`
  animation-name: ${frames};
  animation-duration: ${motion.duration};
  animation-fill-mode: both;
`;

/** The app's slim scrollbar (a thin thumb on hover) for scrolling panels. */
export const customScrollbar = css`
  scrollbar-width: thin;
  scrollbar-color: ${color.secondary} transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background-color: ${color.secondary};
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
  &:hover::-webkit-scrollbar-thumb {
    background-color: ${color.mutedForeground};
  }
`;

/** Vertical rhythm: space between the children of a block, but not after the last (Tailwind's `space-y-*`). */
export const stack = (gap: string) => css`
  & > :not(:last-child) {
    margin-block-end: ${gap};
  }
`;
