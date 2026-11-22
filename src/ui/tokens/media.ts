/**
 * Breakpoints, as ready-to-use media-query strings for `.styles.ts` files:
 *
 *   const Card = styled.div`
 *     padding: ${space[4]};
 *     ${media.phone} { padding: ${space[3]}; }
 *   `;
 *
 * `phone` is exactly Tailwind's `max-md:` (below 768px), the line the phone
 * layout rule draws: phone-only changes use it, so desktop pixels never move.
 */
export const media = {
  phone: "@media (max-width: 767.98px)",
  desktop: "@media (min-width: 768px)",
  // Tailwind's `sm` (640px and up).
  sm: "@media (min-width: 640px)",
  // Below Tailwind's `sm`, where modals turn into bottom sheets.
  narrow: "@media (max-width: 639.98px)",
  reducedMotion: "@media (prefers-reduced-motion: reduce)",
} as const;
