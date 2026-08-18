export interface LoanAttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: number;
  loanLabel: string;
  canManage: boolean;
}
