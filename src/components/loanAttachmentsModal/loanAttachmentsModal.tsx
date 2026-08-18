"use client";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { AttachmentsPanel } from "@/components/attachmentsPanel";
import type { LoanAttachmentsModalProps } from "./loanAttachmentsModal.types";

/** Documents for one loan — agreement PDFs, collateral photos, statements —
 * a many-files pile like client payment proofs, not a fixed set of slots. */
export function LoanAttachmentsModal({
  isOpen,
  onClose,
  loanId,
  loanLabel,
  canManage,
}: LoanAttachmentsModalProps) {
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent style={{ maxWidth: "44rem" }}>
        <ModalHeader className="border-b border-border !px-5 !py-4 sm:!px-6">
          <ModalTitle>Loan documents</ModalTitle>
          <ModalDescription>{loanLabel}</ModalDescription>
        </ModalHeader>
        <ModalBody className="!p-4 sm:!p-6">
          {isOpen && (
            <AttachmentsPanel
              ownerType="loan"
              ownerId={loanId}
              canManage={canManage}
              accept="image/*,application/pdf,text/plain"
              layout="list"
            />
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default LoanAttachmentsModal;
