import { Vehicle } from "@/app/admin/vehicles/vehicles.types";

export interface DocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: Vehicle | null;
    onUpdate: () => void;
}
