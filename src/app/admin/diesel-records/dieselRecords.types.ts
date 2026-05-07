export type FillType = "full" | "partial";
export type CycleStatus = "open" | "closed";
export type PaymentMethod = "Cash" | "Card" | "UPI" | "Fleet";

export interface DieselRecord {
  id: number;
  vehicle_id: number;
  driver_name: string;
  fill_date: string;
  fill_type: FillType;
  fuel_litres: number;
  price_per_l: number;
  current_odo: number;
  station: string | null;
  payment_method: PaymentMethod | null;
  receipt_number: string | null;
  notes: string | null;

  // Derived
  amount: number;
  prev_odo: number | null;
  distance: number | null;
  kml: number | null;
  expected_kml: number | null;
  dev_pct: number | null;
  cost_per_km: number | null;
  cycle_distance: number | null;
  cycle_fuel: number | null;
  cycle_id: number;
  cycle_status: CycleStatus;

  // Audit
  verified_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DieselRecordWithVehicle extends DieselRecord {
  vehicles?: {
    vehicle_number: string;
    company: string;
    model: string;
    expected_kml: number | null;
    tank_capacity: number | null;
  };
}

export interface CreateDieselPayload {
  vehicle_id: number;
  driver_name: string;
  fill_date: string;
  fill_type: FillType;
  fuel_litres: number;
  price_per_l: number;
  current_odo: number;
  station?: string;
  payment_method?: PaymentMethod;
  receipt_number?: string;
  notes?: string;
}
