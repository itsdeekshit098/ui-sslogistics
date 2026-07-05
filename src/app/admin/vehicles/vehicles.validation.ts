import { Vehicle } from "./vehicles.types";
import { hasSeatingCapacity } from "./vehicles.utils";

/**
 * Field-level validation errors for the vehicle create/edit form.
 * Single source of truth — consumed by both CreateVehicleModal and
 * EditVehicleModal via useVehicleForm so the two flows can never validate
 * differently.
 */
export type VehicleFormErrors = {
  vehicle_number?: string;
  vehicle_type?: string;
  truck_type?: string;
  container_length?: string;
  axle_type?: string;
  container_body_type?: string;
  seating_capacity?: string;
  owner_type?: string;
  owner_name?: string;
};

export type VehicleFormData = Omit<Vehicle, "id">;

/**
 * Validates a vehicle form payload against the same conditional-required
 * rules enforced server-side in `src/app/api/vehicles/route.ts`. This is the
 * client-side mirror for fast feedback — the API route remains the source of
 * truth for security (per AGENTS.md: "Never trust frontend validation alone").
 */
export function validateVehicleForm(
  formData: VehicleFormData,
): VehicleFormErrors {
  const errors: VehicleFormErrors = {};

  if (!formData.vehicle_number || formData.vehicle_number.trim() === "") {
    errors.vehicle_number = "Vehicle Number is required";
  }
  if (!formData.vehicle_type || formData.vehicle_type.trim() === "") {
    errors.vehicle_type = "Vehicle Type is required";
  }
  if (!formData.owner_type) {
    errors.owner_type = "Owner Type is required";
  }
  if (!formData.owner_name || formData.owner_name.trim() === "") {
    errors.owner_name = "Owner Name is required";
  }
  if (formData.vehicle_type === "TRUCK" && !formData.truck_type) {
    errors.truck_type = "Truck Type is required";
  }
  if (formData.vehicle_type === "CONTAINER") {
    if (!formData.container_length) {
      errors.container_length = "Container Length is required";
    }
    if (!formData.axle_type) {
      errors.axle_type = "Axle Type is required";
    }
    if (!formData.container_body_type) {
      errors.container_body_type = "Body Type is required";
    }
  }
  if (hasSeatingCapacity(formData.vehicle_type)) {
    if (
      formData.seating_capacity === null ||
      formData.seating_capacity === undefined ||
      !Number.isFinite(formData.seating_capacity)
    ) {
      errors.seating_capacity = "Seating Capacity is required";
    }
  }

  return errors;
}
