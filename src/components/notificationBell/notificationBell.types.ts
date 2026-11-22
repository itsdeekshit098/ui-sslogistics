export interface NotificationBellProps {
  className?: string;
  /** "ghost": borderless round icon button, for the phone top bar.
   * "glass": frosted white button, for the phone dashboard's navy header. */
  variant?: "default" | "ghost" | "glass";
}
