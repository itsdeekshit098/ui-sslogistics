import type { CSSProperties } from "react";

/**
 * @deprecated Layout for a label + control pair in a filter or form. Feature
 * screens apply it with `style=`; a `FormField` component will replace both.
 */
export const fieldGroup: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

/** @deprecated See `fieldGroup`. */
export const fieldLabel: CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--foreground)",
};
