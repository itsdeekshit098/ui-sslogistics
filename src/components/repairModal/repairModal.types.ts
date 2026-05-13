import type { RepairRecord } from "@/components/repairRecordsPage";
import type { Vehicle } from "@/app/admin/vehicles/vehicles.types";

export type RepairModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  vehicles: Vehicle[];
} & (
  | { mode: "create"; record?: never }
  | { mode: "edit"; record: RepairRecord }
);
