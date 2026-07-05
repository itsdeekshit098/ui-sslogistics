import { VehicleFormData, VehicleFormErrors } from "@/app/admin/vehicles/vehicles.validation";
import { NumericVehicleField } from "@/hooks/useVehicleForm";
import { VehicleOwner } from "@/app/admin/vehicles/vehicles.types";

export interface VehicleFormFieldsProps {
  formData: VehicleFormData;
  errors: VehicleFormErrors;
  disabled: boolean;
  /** Owners fetched by the parent modal — filtered client-side by formData.owner_type. */
  owners: VehicleOwner[];
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectChange: (field: string, value: string) => void;
  onVehicleTypeChange: (value: string) => void;
  onOwnerTypeChange: (value: string) => void;
  onNumberChange: (
    field: NumericVehicleField,
    rawValue: string,
    isFloat?: boolean,
  ) => void;
  /** Opens the quick "Add New Owner" modal from the parent. */
  onAddOwnerClick: () => void;
  /** Keeps data-testid values unique between the create and edit modal instances. */
  testIdPrefix: string;
}
