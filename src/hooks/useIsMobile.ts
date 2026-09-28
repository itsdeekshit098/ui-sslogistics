import { useSyncExternalStore } from "react";

// Tailwind's `md` starts at 768px, so "mobile" is everything below it —
// `max-width: 768px` would also match the first md pixel and render the
// phone layout alongside md: styles.
const QUERY = "(max-width: 767.98px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * True below the `md` breakpoint. Used to mount only one of a component's
 * phone/desktop layouts instead of rendering both and hiding one with CSS —
 * which doubled the work of every cell renderer and left hidden duplicates
 * in the DOM for text/test-id lookups to trip over.
 *
 * The server (and hydration) render assumes desktop; phones switch right
 * after hydration, and the layouts keep their `md:hidden` classes so the
 * wrong one is never visible in that moment.
 */
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
