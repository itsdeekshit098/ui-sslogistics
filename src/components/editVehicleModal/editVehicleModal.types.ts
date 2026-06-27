import { Vehicle } from "@/app/admin/vehicles/vehicles.types";

export interface EditVehicleModalProps {
  isOpen: boolean;
  /** The vehicle being edited. Modal stays closed while this is null. */
  vehicle: Vehicle | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}
