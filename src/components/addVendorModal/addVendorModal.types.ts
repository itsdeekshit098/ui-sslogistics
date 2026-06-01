import type { Vendor } from "@/components/repairRecordsPage";

export interface AddVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newVendor: Vendor) => void;
}
