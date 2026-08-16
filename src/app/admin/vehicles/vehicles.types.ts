export type VehicleStatus = "Active" | "Maintenance" | "Idle";

/** active/expiring_soon/expired for FC & insurance, computed server-side (see /api/vehicles GET) */
export type DocExpiryStatus = "active" | "expiring_soon" | "expired";

export const DOC_EXPIRY_STATUS_OPTIONS: { value: DocExpiryStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "expiring_soon", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
];

export const VEHICLE_TYPES = [
  { value: "CAR", label: "Car" },
  { value: "BUS", label: "Bus" },
  { value: "TEMPO_TRAVELLER", label: "Tempo Traveller" },
  { value: "TRUCK", label: "Truck" },
  { value: "CONTAINER", label: "Container" },
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number]["value"];

export const TRUCK_TYPES = [
  { value: "MINI_TRUCK", label: "Mini Truck" },
  { value: "PICKUP_TRUCK", label: "Pickup Truck" },
  { value: "LCV", label: "Light Commercial Vehicle (LCV)" },
  { value: "MCV", label: "Medium Commercial Vehicle (MCV)" },
  { value: "HCV", label: "Heavy Commercial Vehicle (HCV)" },
  { value: "TIPPER_TRUCK", label: "Tipper Truck" },
  { value: "TANKER", label: "Tanker" },
  { value: "TRAILER_TRUCK", label: "Trailer Truck" },
] as const;

export const CONTAINER_LENGTHS = [
  { value: "19_FT", label: "19 ft" },
  { value: "20_FT", label: "20 ft" },
  { value: "22_FT", label: "22 ft" },
  { value: "24_FT", label: "24 ft" },
  { value: "32_FT", label: "32 ft" },
  { value: "40_FT", label: "40 ft" },
] as const;

export const AXLE_TYPES = [
  { value: "SINGLE_AXLE", label: "Single Axle (SXL)" },
  { value: "MULTI_AXLE", label: "Multi Axle (MXL)" },
  { value: "TRAILER", label: "Trailer" },
] as const;

export const CONTAINER_BODY_TYPES = [
  { value: "CLOSED", label: "Closed Container" },
  { value: "FLATBED_OPEN", label: "Flatbed (Open)" },
] as const;

/** Matches the `fuel_type_enum` defined in the database */
export const FUEL_TYPES = [
  { value: "DIESEL", label: "Diesel" },
  { value: "PETROL", label: "Petrol" },
  { value: "CNG", label: "CNG" },
  { value: "LPG", label: "LPG" },
  { value: "ELECTRIC", label: "Electric" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "LNG", label: "LNG" },
] as const;

export type FuelType = (typeof FUEL_TYPES)[number]["value"];

/** Vehicle types that support seating capacity */
export const SEATING_CAPACITY_TYPES: VehicleType[] = [
  "CAR",
  "BUS",
  "TEMPO_TRAVELLER",
];

/**
 * Matches the check constraint on `vehicles.owner_type`, which is now a
 * trigger-maintained mirror of `entities.relationship`
 * (INTERNAL -> OWN, EXTERNAL -> EXTERNAL) — see sql/28_add_entities.sql.
 */
export const OWNER_TYPES = [
  { value: "OWN", label: "Own" },
  { value: "EXTERNAL", label: "External" },
] as const;

export type OwnerType = (typeof OWNER_TYPES)[number]["value"];

/**
 * An owner as returned by the legacy `/api/vehicle-owners` endpoint, which
 * projects `entities` down to these fields so the vehicle forms and the mobile
 * app keep their existing contract. New UI should use `Entity` from
 * `@/components/entitiesPage` instead.
 */
export interface VehicleOwner {
  id: number;
  name: string;
  owner_type: OwnerType;
  created_at?: string;
}

export interface Vehicle {
  id: number;
  vehicle_number: string;
  vehicle_type: string;
  /** Seating capacity — INTEGER in DB; only for Car / Bus / Tempo Traveller */
  seating_capacity: number | null;
  company: string;
  model: string;
  status: VehicleStatus;
  last_service_date: string | null;
  // Truck sub-fields
  truck_type?: string | null;
  // Container sub-fields
  container_length?: string | null;
  axle_type?: string | null;
  container_body_type?: string | null;
  // Document URLs
  rc_url?: string;
  insurance_url?: string;
  fc_url?: string;
  permit_url?: string;
  pollution_url?: string;
  tax_url?: string;
  // Document validity dates (insurance + FC only, for expiry reminders)
  insurance_start_date?: string | null;
  insurance_end_date?: string | null;
  fc_start_date?: string | null;
  fc_end_date?: string | null;
  /** Server-computed from insurance_end_date/fc_end_date — null when no date is set */
  insurance_status?: DocExpiryStatus | null;
  fc_status?: DocExpiryStatus | null;
  // Fuel / performance
  expected_kml?: number | null;
  tank_capacity?: number | null;
  /** Matches fuel_type_enum in DB — always UPPERCASE */
  fuel_type?: FuelType;
  // Ownership
  owner_type?: OwnerType | null;
  owner_name?: string | null;
  created_at?: string;
  updated_at?: string;
}
