import { VehicleFormData, VehicleFormErrors } from "@/app/admin/vehicles/vehicles.validation";
import { NumericVehicleField } from "@/hooks/useVehicleForm";

export interface VehicleFormFieldsProps {
  formData: VehicleFormData;
  errors: VehicleFormErrors;
  disabled: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectChange: (field: string, value: string) => void;
  onVehicleTypeChange: (value: string) => void;
  onNumberChange: (
    field: NumericVehicleField,
    rawValue: string,
    isFloat?: boolean,
  ) => void;
  /** Keeps data-testid values unique between the create and edit modal instances. */
  testIdPrefix: string;
}
