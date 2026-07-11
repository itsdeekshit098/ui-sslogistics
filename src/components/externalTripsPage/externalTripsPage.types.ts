export type TripType = "company_oncall" | "external_user";

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  company_oncall: "Company On-Call",
  external_user: "External Customer",
};

export interface CostItem {
  label: string;
  amount: number;
}

export interface ExternalTrip {
  id: number;
  vehicle_id: number;
  trip_type: TripType;
  customer_name: string | null;
  customer_phone: string | null;
  from_location: string | null;
  to_location: string | null;
  start_date: string | null;
  end_date: string | null;
  driver_id: number | null;
  notes: string | null;
  cost_items: CostItem[];
  total_cost: number;
  amount_received: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalTripWithDetails extends ExternalTrip {
  vehicles?: {
    vehicle_number: string;
    company: string;
    model: string;
  };
  drivers?: {
    id: number;
    name: string;
    phone: string | null;
  };
}

export interface CreateExternalTripPayload {
  vehicle_id: number;
  trip_type: TripType;
  customer_name?: string;
  customer_phone?: string;
  from_location?: string;
  to_location?: string;
  start_date?: string;
  end_date?: string;
  driver_id?: number;
  notes?: string;
  cost_items: CostItem[];
  amount_received: number;
  /** Set when this trip is created from a confirmed trip booking — marks that booking completed. */
  booking_id?: number;
}

export interface UpdateExternalTripPayload {
  id: number;
  customer_name?: string;
  customer_phone?: string;
  from_location?: string;
  to_location?: string;
  start_date?: string;
  end_date?: string | null;
  driver_id?: number | null;
  notes?: string;
  cost_items?: CostItem[];
  amount_received?: number;
}

// ─── Form State ───

export const NOTES_MAX_LENGTH = 500;

export interface ExternalTripFormData {
  vehicleId: string;
  tripType: TripType | null;
  customerName: string;
  customerPhone: string;
  fromLocation: string;
  toLocation: string;
  startDate: string;
  endDate: string;
  driverId: string;
  notes: string;
  costItems: { label: string; amount: string; isPreset: boolean }[];
  amountReceived: string;
}

export const PRESET_COST_LABELS = ["Diesel", "Driver"] as const;

export const getDefaultExternalTripFormData = (): ExternalTripFormData => ({
  vehicleId: "",
  tripType: null,
  customerName: "",
  customerPhone: "",
  fromLocation: "",
  toLocation: "",
  startDate: "",
  endDate: "",
  driverId: "",
  notes: "",
  costItems: PRESET_COST_LABELS.map((label) => ({
    label,
    amount: "",
    isPreset: true,
  })),
  amountReceived: "",
});

// ─── Filter & API Response ───

export interface ExternalTripFilters {
  fromDate: string;
  toDate: string;
  vehicleId: string;
  tripType: TripType | "all";
  page: number;
  pageSize: number;
}

export const getDefaultExternalTripFilters = (): ExternalTripFilters => ({
  fromDate: "",
  toDate: "",
  vehicleId: "",
  tripType: "all",
  page: 1,
  pageSize: 10,
});

export interface ExternalTripSummary {
  totalCost: number;
  totalReceived: number;
  totalProfit: number;
  count: number;
}

export interface ExternalTripListResponse {
  data: ExternalTripWithDetails[];
  total: number;
  summary: ExternalTripSummary;
}
