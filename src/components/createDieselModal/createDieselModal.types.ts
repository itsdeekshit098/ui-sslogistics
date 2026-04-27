export interface CreateDieselModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  vehicles: {
    id: number;
    vehicle_number: string;
    company: string;
    model: string;
    expected_kml: number | null;
    tank_capacity: number | null;
  }[];
}
