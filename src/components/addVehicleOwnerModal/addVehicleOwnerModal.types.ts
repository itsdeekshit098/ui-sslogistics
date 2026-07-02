import type { VehicleOwner, OwnerType } from "@/app/admin/vehicles/vehicles.types";

export interface AddVehicleOwnerModalProps {
  isOpen: boolean;
  /** Pre-selects the owner_type in the form (e.g. the type already chosen on the vehicle form). */
  defaultOwnerType?: OwnerType | null;
  /** Existing owner to edit. Omit/null for create mode. */
  ownerToEdit?: VehicleOwner | null;
  onClose: () => void;
  onSuccess: (owner: VehicleOwner) => void;
}
