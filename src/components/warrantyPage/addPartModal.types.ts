import type { Vendor } from "@/components/repairRecordsPage";

export interface AddPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
