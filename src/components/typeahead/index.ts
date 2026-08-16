export { default as Typeahead } from "./typeahead";
export type { TypeaheadProps } from "./typeahead.types";

/**
 * Styling for an action rendered in the Typeahead's `footer` slot — typically
 * an "+ Add new …" button that creates the missing option inline. Sits inside
 * the portalled listbox, so it matches the option rows' padding and picks up a
 * top border to separate it from them.
 *
 * Pair it with `onPointerDown={(e) => e.stopPropagation()}` on the button, or
 * the listbox's outside-click handler closes before the click registers.
 */
export const typeaheadFooterActionClassName =
  "flex w-full items-center gap-2 rounded-none border-t border-border px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent";
