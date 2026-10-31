export interface SignOutButtonProps {
  /**
   * Influences the styling of the button.
   * - desktop: Styled to fit in a top-right header configuration.
   * - mobile: Full-width sticky styling optimized for a sidebar.
   * - icon: Icon-only, for collapsed sidebar.
   * - drawer: Light text on the navy phone drawer.
   */
  variant?: "desktop" | "mobile" | "icon" | "drawer";
}
