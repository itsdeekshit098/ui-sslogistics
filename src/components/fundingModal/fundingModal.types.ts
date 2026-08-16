export type FundingDirection = "BORROWED" | "LENT";

export interface FundingModalProps {
  isOpen: boolean;
  /** Which side of the arrangement this is. Defaults to BORROWED so existing
   * callers keep working unchanged. */
  direction?: FundingDirection;
  onClose: () => void;
  /** Fired after a successful save; the caller refetches. */
  onSuccess: () => void;
}
