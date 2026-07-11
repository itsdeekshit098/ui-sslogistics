import type { VehicleType } from "@/app/admin/vehicles/vehicles.types";

export type TripBookingStatus = "confirmed" | "completed" | "cancelled";

export const TRIP_BOOKING_STATUS_LABELS: Record<TripBookingStatus, string> = {
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface TripBooking {
  id: number;
  customer_name: string;
  customer_phone: string | null;
  from_location: string;
  to_location: string;
  start_date: string;
  end_date: string | null;
  vehicle_type: VehicleType;
  seating_capacity: number | null;
  vehicle_id: number | null;
  driver_id: number | null;
  status: TripBookingStatus;
  quoted_amount: number | null;
  advance_amount: number;
  notes: string | null;
  external_trip_id: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripBookingWithDetails extends TripBooking {
  vehicles?: {
    vehicle_number: string;
    company: string;
    model: string;
  } | null;
  drivers?: {
    id: number;
    name: string;
    phone: string | null;
  } | null;
}

export interface CreateTripBookingPayload {
  customer_name: string;
  customer_phone?: string;
  from_location: string;
  to_location: string;
  start_date: string;
  end_date?: string;
  vehicle_type: VehicleType;
  seating_capacity?: number;
  vehicle_id?: number;
  driver_id?: number;
  quoted_amount?: number;
  advance_amount?: number;
  notes?: string;
}

export interface UpdateTripBookingPayload {
  id: number;
  customer_name?: string;
  customer_phone?: string;
  from_location?: string;
  to_location?: string;
  start_date?: string;
  end_date?: string | null;
  vehicle_type?: VehicleType;
  seating_capacity?: number | null;
  vehicle_id?: number | null;
  driver_id?: number | null;
  quoted_amount?: number | null;
  advance_amount?: number;
  notes?: string;
  status?: "cancelled";
}

// ─── Form State ───

export const NOTES_MAX_LENGTH = 500;

export interface TripBookingFormData {
  customerName: string;
  customerPhone: string;
  fromLocation: string;
  toLocation: string;
  startDate: string;
  endDate: string;
  vehicleType: VehicleType | null;
  seatingCapacity: string;
  vehicleId: string;
  driverId: string;
  quotedAmount: string;
  advanceAmount: string;
  notes: string;
}

export const getDefaultTripBookingFormData = (): TripBookingFormData => ({
  customerName: "",
  customerPhone: "",
  fromLocation: "",
  toLocation: "",
  startDate: "",
  endDate: "",
  vehicleType: null,
  seatingCapacity: "",
  vehicleId: "",
  driverId: "",
  quotedAmount: "",
  advanceAmount: "",
  notes: "",
});

// ─── Filter & API Response ───

export interface TripBookingFilters {
  status: TripBookingStatus | "all";
  /** Exact-date match — takes precedence over fromDate/toDate when set. */
  onDate: string;
  fromDate: string;
  toDate: string;
  search: string;
  upcoming: boolean;
  page: number;
  pageSize: number;
}

export const getDefaultTripBookingFilters = (): TripBookingFilters => ({
  status: "confirmed",
  onDate: "",
  fromDate: "",
  toDate: "",
  search: "",
  upcoming: false,
  page: 1,
  pageSize: 10,
});

export interface TripBookingSummary {
  upcomingCount: number;
  overdueCount: number;
  completedCount: number;
  cancelledCount: number;
}

export interface TripBookingListResponse {
  data: TripBookingWithDetails[];
  total: number;
  summary?: TripBookingSummary;
}
