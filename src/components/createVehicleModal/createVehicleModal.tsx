"use client";

import React, { useState, useCallback } from "react";
import { CreateVehicleModalProps } from "./createVehicleModal.types";
import { SaveIcon } from "@/components/ui/icon";
import { LoadingSpinner } from "@/components/loadingSpinner";
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
import { getDefaultVehicleFormData, hasSeatingCapacity } from "@/app/admin/vehicles/vehicles.utils";
import {
  VEHICLE_TYPES,
  TRUCK_TYPES,
  CONTAINER_LENGTHS,
  AXLE_TYPES,
  CONTAINER_BODY_TYPES,
  FUEL_TYPES,
} from "@/app/admin/vehicles/vehicles.types";
import { Modal, ModalContent } from "@/components/ui/modal";
import {
  CA_MODAL_GRID,
  CA_MODAL_LABEL_SPACE,
} from "@/app/admin/vehicles/vehicles.styles";

type CreateVehicleErrors = {
  vehicle_number?: string;
  vehicle_type?: string;
  truck_type?: string;
  container_length?: string;
  axle_type?: string;
  container_body_type?: string;
  seating_capacity?: string;
};

/**
 * Inner form component that mounts/unmounts with modal visibility.
 * This ensures form state is naturally reset on each open — no useEffect needed.
 */
const CreateVehicleForm: React.FC<{
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState(getDefaultVehicleFormData());
  const [errors, setErrors] = useState<CreateVehicleErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleVehicleTypeChange = (value: string) => {
    // Reset sub-fields and seating_capacity when type changes
    setFormData((prev) => ({
      ...prev,
      vehicle_type: value,
      seating_capacity: null,
      truck_type: null,
      container_length: null,
      axle_type: null,
      container_body_type: null,
    }));
    setErrors((prev) => ({
      ...prev,
      vehicle_type: undefined,
      truck_type: undefined,
      container_length: undefined,
      axle_type: undefined,
      container_body_type: undefined,
    }));
  };

  const validate = (): CreateVehicleErrors => {
    const newErrors: CreateVehicleErrors = {};

    if (!formData.vehicle_number || formData.vehicle_number.trim() === "") {
      newErrors.vehicle_number = "Vehicle Number is required";
    }
    if (!formData.vehicle_type || formData.vehicle_type.trim() === "") {
      newErrors.vehicle_type = "Vehicle Type is required";
    }

    if (formData.vehicle_type === "TRUCK") {
      if (!formData.truck_type) {
        newErrors.truck_type = "Truck Type is required";
      }
    }

    if (formData.vehicle_type === "CONTAINER") {
      if (!formData.container_length) {
        newErrors.container_length = "Container Length is required";
      }
      if (!formData.axle_type) {
        newErrors.axle_type = "Axle Type is required";
      }
      if (!formData.container_body_type) {
        newErrors.container_body_type = "Body Type is required";
      }
    }

    if (hasSeatingCapacity(formData.vehicle_type)) {
      if (formData.seating_capacity === null || formData.seating_capacity === undefined || !Number.isFinite(formData.seating_capacity)) {
        newErrors.seating_capacity = "Seating Capacity is required";
      }
    }

    return newErrors;
  };

  const handleSubmit = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setLoading(true);

    const payload = {
      ...formData,
      last_service_date: formData.last_service_date
        ? formData.last_service_date
        : null,
    };

    try {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await onSuccess();
        setLoading(false);
        onClose();
      } else {
        const errorData = await response.json();
        setSubmitError(
          `Failed to save vehicle: ${errorData.error || response.statusText}`,
        );
        setLoading(false);
      }
    } catch (error: unknown) {
      setSubmitError(
        `Error saving vehicle: ${error instanceof Error ? error.message : String(error)}`,
      );
      setLoading(false);
    }
  };

  const isTruck = formData.vehicle_type === "TRUCK";
  const isContainer = formData.vehicle_type === "CONTAINER";
  const showSeatingCapacity = hasSeatingCapacity(formData.vehicle_type);

  return (
    <div className="w-full">
      {/* Scrollable Form Content */}
      <div className="space-y-6 sm:mt-2">
        <div className="mb-2 pr-8">
          <h2
            id="create-vehicle-title"
            className="text-xl sm:text-2xl font-bold tracking-tight"
          >
            Add New Vehicle
          </h2>
          <p className="text-sm text-muted-foreground hidden sm:block mt-1">
            Register a new vehicle to the fleet.
          </p>
        </div>
        {submitError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-2 border border-red-100">
            {submitError}
          </div>
        )}
        <div className="space-y-4">
          {/* Row 1: Vehicle Number + Vehicle Type */}
          <div className={CA_MODAL_GRID}>
            <div className={CA_MODAL_LABEL_SPACE}>
              <Label htmlFor="vehicle_number">
                Vehicle Number <span className="text-red-500">*</span>
              </Label>
              <Input
                disabled={loading}
                data-testid="components-createVehicleModal-createVehicleModal-input-1"
                id="vehicle_number"
                placeholder="AP 02 AB 1234"
                value={formData.vehicle_number}
                onChange={(e) => {
                  handleChange(e);
                  if (errors.vehicle_number)
                    setErrors((prev) => ({
                      ...prev,
                      vehicle_number: undefined,
                    }));
                }}
                className={
                  errors.vehicle_number
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }
              />
              {errors.vehicle_number && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.vehicle_number}
                </p>
              )}
            </div>
            <div className={CA_MODAL_LABEL_SPACE}>
              <Label htmlFor="vehicle_type">
                Vehicle Type <span className="text-red-500">*</span>
              </Label>
              <Select
                disabled={loading}
                data-testid="components-createVehicleModal-createVehicleModal-select-1"
                value={formData.vehicle_type}
                onValueChange={handleVehicleTypeChange}
              >
                <SelectTrigger
                  className={
                    errors.vehicle_type
                      ? "border-red-500 focus:ring-red-500"
                      : ""
                  }
                >
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.vehicle_type && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.vehicle_type}
                </p>
              )}
            </div>
          </div>

          {/* Truck Sub-fields */}
          {isTruck && (
            <div className={CA_MODAL_LABEL_SPACE}>
              <Label htmlFor="truck_type">
                Truck Type <span className="text-red-500">*</span>
              </Label>
              <Select
                disabled={loading}
                value={formData.truck_type ?? ""}
                onValueChange={(val) => {
                  handleSelectChange("truck_type", val);
                  if (errors.truck_type)
                    setErrors((prev) => ({ ...prev, truck_type: undefined }));
                }}
              >
                <SelectTrigger
                  className={
                    errors.truck_type ? "border-red-500 focus:ring-red-500" : ""
                  }
                >
                  <SelectValue placeholder="Select Truck Type" />
                </SelectTrigger>
                <SelectContent>
                  {TRUCK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.truck_type && (
                <p className="text-xs text-red-500 mt-1">{errors.truck_type}</p>
              )}
            </div>
          )}

          {/* Container Sub-fields */}
          {isContainer && (
            <>
              <div className={CA_MODAL_GRID}>
                <div className={CA_MODAL_LABEL_SPACE}>
                  <Label htmlFor="container_length">
                    Container Length <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    disabled={loading}
                    value={formData.container_length ?? ""}
                    onValueChange={(val) => {
                      handleSelectChange("container_length", val);
                      if (errors.container_length)
                        setErrors((prev) => ({
                          ...prev,
                          container_length: undefined,
                        }));
                    }}
                  >
                    <SelectTrigger
                      className={
                        errors.container_length
                          ? "border-red-500 focus:ring-red-500"
                          : ""
                      }
                    >
                      <SelectValue placeholder="Select Length" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTAINER_LENGTHS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.container_length && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.container_length}
                    </p>
                  )}
                </div>
                <div className={CA_MODAL_LABEL_SPACE}>
                  <Label htmlFor="axle_type">
                    Axle Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    disabled={loading}
                    value={formData.axle_type ?? ""}
                    onValueChange={(val) => {
                      handleSelectChange("axle_type", val);
                      if (errors.axle_type)
                        setErrors((prev) => ({
                          ...prev,
                          axle_type: undefined,
                        }));
                    }}
                  >
                    <SelectTrigger
                      className={
                        errors.axle_type
                          ? "border-red-500 focus:ring-red-500"
                          : ""
                      }
                    >
                      <SelectValue placeholder="Select Axle Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {AXLE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.axle_type && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.axle_type}
                    </p>
                  )}
                </div>
              </div>
              <div className={CA_MODAL_LABEL_SPACE}>
                <Label htmlFor="container_body_type">
                  Body Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  disabled={loading}
                  value={formData.container_body_type ?? ""}
                  onValueChange={(val) => {
                    handleSelectChange("container_body_type", val);
                    if (errors.container_body_type)
                      setErrors((prev) => ({
                        ...prev,
                        container_body_type: undefined,
                      }));
                  }}
                >
                  <SelectTrigger
                    className={
                      errors.container_body_type
                        ? "border-red-500 focus:ring-red-500"
                        : ""
                    }
                  >
                    <SelectValue placeholder="Select Body Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTAINER_BODY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.container_body_type && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.container_body_type}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Row: Company + Model */}
          <div className={CA_MODAL_GRID}>
            <div className={CA_MODAL_LABEL_SPACE}>
              <Label htmlFor="company">Company</Label>
              <Input
                disabled={loading}
                data-testid="components-createVehicleModal-createVehicleModal-input-2"
                id="company"
                placeholder="e.g. Tata"
                value={formData.company}
                onChange={handleChange}
              />
            </div>
            <div className={CA_MODAL_LABEL_SPACE}>
              <Label htmlFor="model">Model</Label>
              <Input
                disabled={loading}
                data-testid="components-createVehicleModal-createVehicleModal-input-3"
                id="model"
                placeholder="e.g. Starbus"
                value={formData.model}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Seating Capacity — only for Car / Bus / Tempo Traveller */}
          {showSeatingCapacity && (
            <div className={CA_MODAL_GRID}>
              <div className={CA_MODAL_LABEL_SPACE}>
                <Label htmlFor="seating_capacity">
                  Seating Capacity <span className="text-red-500">*</span>
                </Label>
                <Input
                  disabled={loading}
                  data-testid="components-createVehicleModal-createVehicleModal-input-4"
                  id="seating_capacity"
                  type="number"
                  placeholder="e.g. 40"
                  min="1"
                  value={formData.seating_capacity?.toString() ?? ""}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      seating_capacity: e.target.value ? parseInt(e.target.value, 10) : null,
                    }));
                    if (errors.seating_capacity) {
                      setErrors((prev) => ({ ...prev, seating_capacity: undefined }));
                    }
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={errors.seating_capacity ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {errors.seating_capacity && (
                  <p className="text-xs text-red-500 mt-1">{errors.seating_capacity}</p>
                )}
              </div>
              <div className={CA_MODAL_LABEL_SPACE}>
                <Label htmlFor="last_service_date">Last Service Date</Label>
                <Input
                  disabled={loading}
                  data-testid="components-createVehicleModal-createVehicleModal-input-5"
                  id="last_service_date"
                  type="date"
                  value={formData.last_service_date || ""}
                  onChange={handleChange}
                />
              </div>
            </div>
          )}

          {/* Last Service Date — standalone row when no seating capacity */}
          {!showSeatingCapacity && formData.vehicle_type !== "" && (
            <div className={CA_MODAL_GRID}>
              <div className={CA_MODAL_LABEL_SPACE}>
                <Label htmlFor="last_service_date">Last Service Date</Label>
                <Input
                  disabled={loading}
                  data-testid="components-createVehicleModal-createVehicleModal-input-5b"
                  id="last_service_date"
                  type="date"
                  value={formData.last_service_date || ""}
                  onChange={handleChange}
                />
              </div>
            </div>
          )}

          {/* Row: Status + Fuel Type */}
          <div className={CA_MODAL_GRID}>
            <div className={CA_MODAL_LABEL_SPACE}>
              <Label htmlFor="status">Initial Status</Label>
              <Select
                disabled={loading}
                data-testid="components-createVehicleModal-createVehicleModal-select-2"
                value={formData.status}
                onValueChange={(val) => handleSelectChange("status", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Idle">Idle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={CA_MODAL_LABEL_SPACE}>
              <Label htmlFor="fuel_type">Fuel Type</Label>
              <Select
                disabled={loading}
                data-testid="components-createVehicleModal-createVehicleModal-select-3"
                value={formData.fuel_type || "DIESEL"}
                onValueChange={(val) => handleSelectChange("fuel_type", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Fuel Type" />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row: Expected Km/L + Tank Capacity */}
          <div className={CA_MODAL_GRID}>
            <div className={CA_MODAL_LABEL_SPACE}>
              <Label htmlFor="expected_kml">Expected Km/L</Label>
              <Input
                disabled={loading}
                data-testid="components-createVehicleModal-createVehicleModal-input-6"
                id="expected_kml"
                type="number"
                placeholder="e.g. 4.5"
                step="0.01"
                min="0"
                value={formData.expected_kml ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    expected_kml: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  }))
                }
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
            <div className={CA_MODAL_LABEL_SPACE}>
              <Label htmlFor="tank_capacity">Tank Capacity (L)</Label>
              <Input
                disabled={loading}
                data-testid="components-createVehicleModal-createVehicleModal-input-7"
                id="tank_capacity"
                type="number"
                placeholder="e.g. 200"
                step="0.01"
                min="0"
                value={formData.tank_capacity ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tank_capacity: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  }))
                }
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
          </div>
        </div>

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
    </div>
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
      <ModalContent className="w-[95vw] sm:max-w-2xl p-0 overflow-hidden rounded-xl sm:rounded-2xl">
        <div className="max-h-[85vh] overflow-y-auto p-4 sm:p-6 scrollbar-custom">
          <CreateVehicleForm onClose={onClose} onSuccess={onSuccess} />
        </div>
      </ModalContent>
    </Modal>
  );
};

export default CreateVehicleModal;
