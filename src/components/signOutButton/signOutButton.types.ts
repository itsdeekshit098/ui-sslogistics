export interface SignOutButtonProps {
  /**
   * Influences the styling of the button.
   * - desktop: Styled to fit in a top-right header configuration.
   * - mobile: Full-width sticky styling optimized for a sidebar.
   * - icon: Icon-only, for collapsed sidebar.
   */
  variant?: "desktop" | "mobile" | "icon";
}
