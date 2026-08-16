import type { Lender } from "@/components/loansPage/loansPage.types";

export interface LenderModalProps {
  isOpen: boolean;
  /** Preselects the type when opened from a context that implies one. */
  defaultKind?: "INSTITUTION" | "PRIVATE";
  lenderToEdit?: Lender | null;
  onClose: () => void;
  onSuccess: (lender: Lender) => void;
  /** Stack above an already-open modal, for inline "+ Add" from a dropdown. */
  nested?: boolean;
}
