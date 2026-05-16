export interface IdleTimeoutModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Countdown seconds remaining */
  secondsLeft: number;
  /** Called when user clicks "Stay Logged In" */
  onStay: () => void;
  /** Called when user clicks "Log Out Now" */
  onLogout: () => void;
}
