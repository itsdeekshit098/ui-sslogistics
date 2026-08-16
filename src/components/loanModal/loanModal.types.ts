import type { Loan } from "@/components/loansPage/loansPage.types";

export interface LoanModalProps {
  isOpen: boolean;
  /** Passing a loan switches the modal to edit mode. */
  loanToEdit?: Loan | null;
  onClose: () => void;
  /** Fired after a successful save; the caller refetches. */
  onSuccess: () => void;
}
