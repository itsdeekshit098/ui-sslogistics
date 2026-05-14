import type { ExternalTripWithDetails } from "@/components/externalTripsPage/externalTripsPage.types";
import type { Vehicle } from "@/app/admin/vehicles/vehicles.types";

export type ExternalTripsModalProps =
  | {
      mode: "create";
      isOpen: boolean;
      onClose: () => void;
      onSuccess: () => Promise<void>;
      vehicles: Vehicle[];
      record?: undefined;
    }
  | {
      mode: "edit";
      record: ExternalTripWithDetails;
      isOpen: boolean;
      onClose: () => void;
      onSuccess: () => Promise<void>;
      vehicles: Vehicle[];
    };
