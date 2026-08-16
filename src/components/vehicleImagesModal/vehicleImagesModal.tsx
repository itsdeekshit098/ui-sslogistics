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
import type { VehicleImagesModalProps } from "./vehicleImagesModal.types";

/** Photos for one vehicle — a many-files gallery, separate from the six
 * fixed document slots in `documentModal` (RC, insurance, etc). */
export function VehicleImagesModal({
  isOpen,
  onClose,
  vehicleId,
  vehicleNumber,
  canManage,
}: VehicleImagesModalProps) {
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent style={{ maxWidth: "44rem" }}>
        <ModalHeader className="border-b border-border !px-5 !py-4 sm:!px-6">
          <ModalTitle>Vehicle photos</ModalTitle>
          <ModalDescription>
            {vehicleNumber} · Add clear exterior, interior, and condition photos
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="!p-4 sm:!p-6">
          {isOpen && (
            <AttachmentsPanel
              ownerType="vehicle"
              ownerId={vehicleId}
              canManage={canManage}
              accept="image/*"
              layout="grid"
            />
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default VehicleImagesModal;
