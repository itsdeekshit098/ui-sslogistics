import type { TripBookingWithDetails } from "@/components/tripBookingsPage/tripBookingsPage.types";
import type { Vehicle } from "@/app/admin/vehicles/vehicles.types";

export type TripBookingsModalProps =
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
      record: TripBookingWithDetails;
      isOpen: boolean;
      onClose: () => void;
      onSuccess: () => Promise<void>;
      vehicles: Vehicle[];
    };
