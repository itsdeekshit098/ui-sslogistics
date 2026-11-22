export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  /**
   * `default` is the theme's skeleton fill, which stays visible on page, card and muted
   * surfaces alike. `muted` is the quieter fill for placeholders drawn inside a table.
   */
  tone?: "default" | "muted";
  /** Lay out as a block box instead of inline-block (for use outside a flex or grid parent). */
  block?: boolean;
  /** Centre horizontally. Implies `block`. */
  center?: boolean;
  className?: string;
}
