import type { ExternalTripWithDetails } from "@/components/externalTripsPage/externalTripsPage.types";
import type { Vehicle } from "@/app/admin/vehicles/vehicles.types";

/** Values carried over from a confirmed trip booking being completed into a trip. */
export interface ExternalTripPrefill {
  customerName?: string;
  customerPhone?: string;
  fromLocation?: string;
  toLocation?: string;
  startDate?: string;
  endDate?: string;
  vehicleId?: number;
  driverId?: number;
  /** Shown read-only in the form so the owner remembers what was agreed at booking time. */
  quotedAmount?: number | null;
  advanceAmount?: number;
}

export type ExternalTripsModalProps =
  | {
      mode: "create";
      isOpen: boolean;
      onClose: () => void;
      onSuccess: () => Promise<void>;
      vehicles: Vehicle[];
      record?: undefined;
      /** When set, the created trip completes this booking (see /api/external-trips `booking_id`). */
      bookingId?: number;
      prefill?: ExternalTripPrefill;
    }
  | {
      mode: "edit";
      record: ExternalTripWithDetails;
      isOpen: boolean;
      onClose: () => void;
      onSuccess: () => Promise<void>;
      vehicles: Vehicle[];
      bookingId?: undefined;
      prefill?: undefined;
    };
