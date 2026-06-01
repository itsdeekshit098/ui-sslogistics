import type { Vendor } from "@/components/repairRecordsPage";
import type { WarrantyItem } from "@/components/warrantyPage/warrantyPage.types";

export interface PartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: "add" | "edit";
  initialData?: WarrantyItem; // Required when mode === "edit"
  vehicles: VehicleOption[];
  vendors: Vendor[];
  partOptions: { id: number; name: string }[];
  onVendorAdded: (vendor: Vendor) => void;
  onPartAdded: (part: { id: number; name: string }) => void;
}

export interface VehicleOption {
  id: number;
  vehicle_number: string;
  company: string;
  model: string;
}

export interface PartFormState {
  id?: number; // For edit mode
  vehicleId: string;
  partName: string;
  vendorId: string;
  cost: string;
  purchaseDate: string;
  warrantyDuration: string;
  warrantyDurationUnit: "months" | "years";
  warrantyExpiry: string;
  notes: string;
}

export type { Vendor };
