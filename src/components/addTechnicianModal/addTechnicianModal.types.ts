import type {
  Technician,
  SpecializationOption,
} from "@/components/techniciansPage";

export interface AddTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTechnician: Technician) => void;
  specializations: SpecializationOption[];
  onSpecializationAdded?: (spec: SpecializationOption) => void;
  mode?: "standalone" | "nested";
  technicianToEdit?: Technician | null;
}
