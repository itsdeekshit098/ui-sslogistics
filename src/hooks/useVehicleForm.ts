"use client";

import { useCallback, useState } from "react";
import { Vehicle } from "@/app/admin/vehicles/vehicles.types";
import { getDefaultVehicleFormData } from "@/app/admin/vehicles/vehicles.utils";
import {
  validateVehicleForm,
  VehicleFormData,
  VehicleFormErrors,
} from "@/app/admin/vehicles/vehicles.validation";
import { VehicleServiceResult } from "@/services/vehiclesService";

export type NumericVehicleField =
  | "seating_capacity"
  | "expected_kml"
  | "tank_capacity";

export interface UseVehicleFormOptions {
  /** Existing vehicle to seed the form with. Omit/null for create mode. */
  initialVehicle?: Vehicle | null;
  /** Persists the form. The hook is transport-agnostic (DIP) — the caller
   *  decides whether this is a create or an update call. */
  onSubmit: (payload: VehicleFormData) => Promise<VehicleServiceResult>;
  /** Runs after a successful submit (e.g. refetch the list, close the modal). */
  onSuccess: () => void | Promise<void>;
}

const buildInitialFormData = (vehicle?: Vehicle | null): VehicleFormData => {
  if (!vehicle) return getDefaultVehicleFormData();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...rest } = vehicle;
  return { ...getDefaultVehicleFormData(), ...rest };
};

/**
 * Owns all vehicle-form state, change handlers, validation, and the
 * submit lifecycle. Shared by CreateVehicleModal and EditVehicleModal so the
 * two flows can never validate or behave differently from one another.
 */
export function useVehicleForm({
  initialVehicle,
  onSubmit,
  onSuccess,
}: UseVehicleFormOptions) {
  const [formData, setFormData] = useState<VehicleFormData>(() =>
    buildInitialFormData(initialVehicle),
  );
  const [errors, setErrors] = useState<VehicleFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) =>
      prev[field as keyof VehicleFormErrors]
        ? { ...prev, [field]: undefined }
        : prev,
    );
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { id, value } = e.target;
      setFormData((prev) => ({ ...prev, [id]: value }));
      clearFieldError(id);
    },
    [clearFieldError],
  );

  const handleSelectChange = useCallback(
    (field: string, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      clearFieldError(field);
    },
    [clearFieldError],
  );

  /** Changing the vehicle type invalidates every type-dependent sub-field. */
  const handleVehicleTypeChange = useCallback((value: string) => {
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
  }, []);

  /** Changing the owner type invalidates the previously-selected owner name. */
  const handleOwnerTypeChange = useCallback((value: string) => {
    setFormData((prev) => ({
      ...prev,
      owner_type: value as VehicleFormData["owner_type"],
      owner_name: null,
    }));
    clearFieldError("owner_type");
    clearFieldError("owner_name");
  }, [clearFieldError]);

  const handleNumberChange = useCallback(
    (field: NumericVehicleField, rawValue: string, isFloat = false) => {
      setFormData((prev) => ({
        ...prev,
        [field]: rawValue
          ? isFloat
            ? parseFloat(rawValue)
            : parseInt(rawValue, 10)
          : null,
      }));
      clearFieldError(field);
    },
    [clearFieldError],
  );

  const handleSubmit = useCallback(async () => {
    const validationErrors = validateVehicleForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setLoading(true);

    const payload: VehicleFormData = {
      ...formData,
      last_service_date: formData.last_service_date || null,
    };

    const result = await onSubmit(payload);

    if (result.success) {
      await onSuccess();
      setLoading(false);
    } else {
      setSubmitError(result.error ?? "Unexpected error saving vehicle.");
      setLoading(false);
    }
  }, [formData, onSubmit, onSuccess]);

  return {
    formData,
    errors,
    submitError,
    loading,
    setFormData,
    handleChange,
    handleSelectChange,
    handleVehicleTypeChange,
    handleOwnerTypeChange,
    handleNumberChange,
    handleSubmit,
    clearSubmitError: () => setSubmitError(null),
  };
}
