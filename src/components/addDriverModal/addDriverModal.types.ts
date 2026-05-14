import type { Driver } from "@/components/driversPage";

export interface AddDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDriver: Driver) => void;
  mode?: "standalone" | "nested";
  driverToEdit?: Driver | null;
}
