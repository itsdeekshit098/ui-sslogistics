import type { DieselRecordWithVehicle } from "@/app/admin/diesel-records/dieselRecords.types";

export interface EditDieselModalProps {
  record: DieselRecordWithVehicle | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}
