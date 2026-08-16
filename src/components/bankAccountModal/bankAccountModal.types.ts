import type { BankAccount } from "@/components/bankAccountsPage/bankAccountsPage.types";

export interface BankAccountModalProps {
  isOpen: boolean;
  accountToEdit?: BankAccount | null;
  onClose: () => void;
  onSuccess: (account: BankAccount) => void;
  /** Stack above an already-open modal, for inline "+ Add" from the loan form. */
  nested?: boolean;
}
