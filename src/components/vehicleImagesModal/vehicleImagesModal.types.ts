export interface VehicleImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: number;
  vehicleNumber: string;
  canManage: boolean;
}
