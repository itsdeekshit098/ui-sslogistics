"use client";

import React, { useCallback } from "react";
import { EditVehicleModalProps } from "./editVehicleModal.types";
import { Vehicle } from "@/app/admin/vehicles/vehicles.types";
import { SaveIcon } from "@/components/ui/icon";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent } from "@/components/ui/modal";
import { VehicleFormFields } from "@/components/vehicleFormFields";
import { useVehicleForm } from "@/hooks/useVehicleForm";
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
  const { formData, errors, submitError, loading, handleChange, handleSelectChange, handleVehicleTypeChange, handleNumberChange, handleSubmit } =
    useVehicleForm({
      initialVehicle: vehicle,
      onSubmit: (payload) => updateVehicle(vehicle.id, payload),
      onSuccess: async () => {
        await onSuccess();
        onClose();
      },
    });

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  return (
    <div className="w-full">
      <div className="space-y-6 sm:mt-2">
        <div className="mb-2 pr-8">
          <h2
            id="edit-vehicle-title"
            className="text-xl sm:text-2xl font-bold tracking-tight"
          >
            Edit Vehicle
          </h2>
          <p className="text-sm text-muted-foreground hidden sm:block mt-1">
            Make changes to the vehicle details here.
          </p>
        </div>
        {submitError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-2 border border-red-100">
            {submitError}
          </div>
        )}

        <VehicleFormFields
          formData={formData}
          errors={errors}
          disabled={loading}
          onChange={handleChange}
          onSelectChange={handleSelectChange}
          onVehicleTypeChange={handleVehicleTypeChange}
          onNumberChange={handleNumberChange}
          testIdPrefix="components-editVehicleModal-editVehicleModal"
        />

        {/* Footer Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 pb-2 border-t mt-4">
          <Button
            data-testid="components-editVehicleModal-editVehicleModal-button-1"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="w-full sm:w-auto mb-2 sm:mb-0"
          >
            Cancel
          </Button>
          <Button
            data-testid="components-editVehicleModal-editVehicleModal-button-2"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
            )}
            {loading ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
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
      <ModalContent className="w-[95vw] sm:max-w-2xl p-0 overflow-hidden rounded-xl sm:rounded-2xl">
        <div className="max-h-[85vh] overflow-y-auto p-4 sm:p-6 scrollbar-custom">
          {vehicle && (
            <EditVehicleForm
              vehicle={vehicle}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          )}
        </div>
      </ModalContent>
    </Modal>
  );
};

export default EditVehicleModal;
