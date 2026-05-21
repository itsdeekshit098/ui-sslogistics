import type { RepairRecord } from "@/components/repairRecordsPage";
import type { Vehicle } from "@/app/admin/vehicles/vehicles.types";
import type { Technician, SpecializationOption } from "@/components/techniciansPage";

export type RepairModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  vehicles: Vehicle[];
  technicians: Technician[];
  specializations: SpecializationOption[];
  repairOptions: Record<string, string[]>;
  onIssueAdded: (category: string, issueName: string) => void;
  onTechnicianAdded: (newTech: Technician) => void;
  onSpecializationAdded: (newSpec: SpecializationOption) => void;
} & (
  | { mode: "create"; record?: never; defaultVehicleId?: string }
  | { mode: "edit"; record: RepairRecord }
);
