"use client";

import React, { useState, useCallback } from "react";
import { SaveIcon } from "@/components/ui/icon";
import type { AddVehicleOwnerModalProps } from "./addVehicleOwnerModal.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loadingSpinner";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import { OWNER_TYPES } from "@/app/admin/vehicles/vehicles.types";

const AddVehicleOwnerForm: React.FC<{
  defaultOwnerType?: AddVehicleOwnerModalProps["defaultOwnerType"];
  ownerToEdit?: AddVehicleOwnerModalProps["ownerToEdit"];
  onClose: () => void;
  onSuccess: AddVehicleOwnerModalProps["onSuccess"];
}> = ({ defaultOwnerType, ownerToEdit, onClose, onSuccess }) => {
  const isEdit = !!ownerToEdit;
  const [name, setName] = useState(ownerToEdit?.name ?? "");
  const [ownerType, setOwnerType] = useState(
    ownerToEdit?.owner_type ?? defaultOwnerType ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = "Owner name is required";
    }
    if (!ownerType) {
      errors.owner_type = "Owner type is required";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/vehicle-owners", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { id: ownerToEdit!.id, name: name.trim(), owner_type: ownerType }
            : { name: name.trim(), owner_type: ownerType },
        ),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess(data.data.owner);
        onClose();
      } else {
        setSubmitError(data.error || "Failed to save owner");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ModalHeader>
        <ModalTitle>{isEdit ? "Edit Owner" : "Add New Owner"}</ModalTitle>
        <ModalDescription>
          {isEdit
            ? "Update this owner's name or type."
            : "Add an owner (proprietorship or external party) for vehicles."}
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="owner_type">
              Owner Type <span className="text-destructive">*</span>
            </Label>
            <Select
              disabled={loading}
              value={ownerType}
              onValueChange={(val) => {
                setOwnerType(val as typeof ownerType);
                setFieldErrors((prev) => ({ ...prev, owner_type: "" }));
              }}
            >
              <SelectTrigger
                className={fieldErrors.owner_type ? "border-destructive" : ""}
              >
                <SelectValue placeholder="Select Owner Type" />
              </SelectTrigger>
              <SelectContent>
                {OWNER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.owner_type && (
              <span className="text-xs text-destructive">
                {fieldErrors.owner_type}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">
              Owner Name <span className="text-destructive">*</span>
            </Label>
            <Input
              disabled={loading}
              id="name"
              placeholder="e.g. My Proprietorship / Dad's Proprietorship / ABC Logistics"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, name: "" }));
              }}
              className={fieldErrors.name ? "border-destructive" : ""}
            />
            {fieldErrors.name && (
              <span className="text-xs text-destructive">{fieldErrors.name}</span>
            )}
          </div>
        </div>

        {submitError && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm mt-4 border border-destructive/20">
            {submitError}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
          )}
          {loading ? "Saving..." : isEdit ? "Update Owner" : "Add Owner"}
        </Button>
      </ModalFooter>
    </>
  );
};

const AddVehicleOwnerModal: React.FC<AddVehicleOwnerModalProps> = ({
  isOpen,
  defaultOwnerType,
  ownerToEdit,
  onClose,
  onSuccess,
}) => {
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent style={{ maxWidth: "28rem", padding: 0 }}>
        {isOpen && (
          <AddVehicleOwnerForm
            defaultOwnerType={defaultOwnerType}
            ownerToEdit={ownerToEdit}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        )}
      </ModalContent>
    </Modal>
  );
};

export { AddVehicleOwnerModal };
export default AddVehicleOwnerModal;
