"use client";

import React, { useCallback, useState } from "react";
import { EditVehicleModalProps } from "./editVehicleModal.types";
import { Vehicle, VehicleOwner } from "@/app/admin/vehicles/vehicles.types";
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
  ModalFooter,
} from "@/components/ui/modal";
import { VehicleFormFields } from "@/components/vehicleFormFields";
import { AddVehicleOwnerModal } from "@/components/addVehicleOwnerModal";
import { useVehicleForm } from "@/hooks/useVehicleForm";
import { useVehicleOwners } from "@/hooks/useVehicleOwners";
import { updateVehicle } from "@/services/vehiclesService";

/**
 * Inner form — mounts/unmounts with modal visibility so form state resets
 * naturally on each open (same pattern as CreateVehicleModal).
 */
const EditVehicleForm: React.FC<{
  vehicle: Vehicle;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}> = ({ vehicle, onClose, onSuccess }) => {
  const { formData, errors, submitError, loading, handleChange, handleSelectChange, handleVehicleTypeChange, handleOwnerTypeChange, handleNumberChange, handleSubmit } =
    useVehicleForm({
      initialVehicle: vehicle,
      onSubmit: (payload) => updateVehicle(vehicle.id, payload),
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
        <ModalTitle>Edit Vehicle</ModalTitle>
        <ModalDescription className="hidden sm:block">
          Make changes to the vehicle details here.
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
          testIdPrefix="components-editVehicleModal-editVehicleModal"
        />

        <AddVehicleOwnerModal
          isOpen={showAddOwner}
          defaultOwnerType={formData.owner_type}
          onClose={() => setShowAddOwner(false)}
          onSuccess={handleOwnerAdded}
        />

        </div>
      </ModalBody>
      {/* Pinned below the scrolling fields, like every other form — on a
          phone the buttons were at the very bottom of a long scroll. */}
      <ModalFooter>
        <Button
          data-testid="components-editVehicleModal-editVehicleModal-button-1"
          variant="outline"
          onClick={handleClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          data-testid="components-editVehicleModal-editVehicleModal-button-2"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
          )}
          {loading ? "Saving..." : "Save changes"}
        </Button>
      </ModalFooter>
    </>
  );
};

/**
 * Wrapper — conditionally mounts/unmounts the form. Mirrors CreateVehicleModal
 * so the two flows share the same chrome instead of drifting (the previous
 * inline edit modal used a different Modal/ModalHeader/ModalFooter layout and
 * had no Cancel button).
 */
const EditVehicleModal: React.FC<EditVehicleModalProps> = ({
  isOpen,
  vehicle,
  onClose,
  onSuccess,
}) => {
  return (
    <Modal open={isOpen && !!vehicle} onOpenChange={(open) => !open && onClose()}>
      <ModalContent className="w-[95vw] sm:max-w-2xl rounded-xl sm:rounded-2xl scrollbar-custom">
        {vehicle && (
          <EditVehicleForm
            vehicle={vehicle}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        )}
      </ModalContent>
    </Modal>
  );
};

export default EditVehicleModal;
