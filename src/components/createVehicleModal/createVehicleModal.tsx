"use client";

import React, { useCallback, useState } from "react";
import { CreateVehicleModalProps } from "./createVehicleModal.types";
import { SaveIcon } from "@/components/ui/icon";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
} from "@/components/ui/modal";
import { VehicleFormFields } from "@/components/vehicleFormFields";
import { AddVehicleOwnerModal } from "@/components/addVehicleOwnerModal";
import { useVehicleForm } from "@/hooks/useVehicleForm";
import { useVehicleOwners } from "@/hooks/useVehicleOwners";
import { createVehicle } from "@/services/vehiclesService";
import { VehicleOwner } from "@/app/admin/vehicles/vehicles.types";

/**
 * Inner form component that mounts/unmounts with modal visibility.
 * This ensures form state is naturally reset on each open — no useEffect needed.
 */
const CreateVehicleForm: React.FC<{
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}> = ({ onClose, onSuccess }) => {
  const { formData, errors, submitError, loading, handleChange, handleSelectChange, handleVehicleTypeChange, handleOwnerTypeChange, handleNumberChange, handleSubmit } =
    useVehicleForm({
      onSubmit: createVehicle,
      onSuccess: async () => {
        await onSuccess();
        onClose();
      },
    });

  const { owners, addOwner } = useVehicleOwners();
  const [showAddOwner, setShowAddOwner] = useState(false);

  const handleOwnerAdded = useCallback((newOwner: VehicleOwner) => {
    addOwner(newOwner);
    // Adopt the new owner's type too — it can be changed inside the add-owner
    // modal, and syncing only the name would persist a mismatched pair.
    handleSelectChange("owner_type", newOwner.owner_type);
    handleSelectChange("owner_name", newOwner.name);
    setShowAddOwner(false);
  }, [addOwner, handleSelectChange]);

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  return (
    <>
      <ModalHeader>
        <ModalTitle>Add New Vehicle</ModalTitle>
        <ModalDescription className="hidden sm:block">
          Register a new vehicle to the fleet.
        </ModalDescription>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-6">
        {submitError && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm mb-2 border border-destructive/20">
            {submitError}
          </div>
        )}

        <VehicleFormFields
          formData={formData}
          errors={errors}
          disabled={loading}
          owners={owners}
          onChange={handleChange}
          onSelectChange={handleSelectChange}
          onVehicleTypeChange={handleVehicleTypeChange}
          onOwnerTypeChange={handleOwnerTypeChange}
          onNumberChange={handleNumberChange}
          onAddOwnerClick={() => setShowAddOwner(true)}
          testIdPrefix="components-createVehicleModal-createVehicleModal"
        />

        <AddVehicleOwnerModal
          isOpen={showAddOwner}
          defaultOwnerType={formData.owner_type}
          onClose={() => setShowAddOwner(false)}
          onSuccess={handleOwnerAdded}
        />

        <div className="bg-muted/50 p-4 rounded-md text-sm text-muted-foreground mt-2">
          <strong>Note:</strong> You will be able to securely upload PDF and
          Image documents (RC, FC, Insurance, etc.) to Supabase Storage by
          clicking &quot;Manage Docs&quot; on the main vehicle table after
          successfully creating this vehicle entry.
        </div>

        {/* Footer Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 pb-2 border-t mt-4">
          <Button
            data-testid="components-createVehicleModal-createVehicleModal-button-1"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="w-full sm:w-auto mb-2 sm:mb-0"
          >
            Cancel
          </Button>
          <Button
            data-testid="components-createVehicleModal-createVehicleModal-button-2"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
            )}
            {loading ? "Saving..." : "Save Vehicle"}
          </Button>
        </div>
      </div>
      </ModalBody>
    </>
  );
};

/**
 * Wrapper that conditionally mounts/unmounts the form.
 * This pattern avoids useEffect-based state resets entirely.
 */
const CreateVehicleModal: React.FC<CreateVehicleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent className="w-[95vw] sm:max-w-2xl rounded-xl sm:rounded-2xl scrollbar-custom">
        <CreateVehicleForm onClose={onClose} onSuccess={onSuccess} />
      </ModalContent>
    </Modal>
  );
};

export default CreateVehicleModal;
