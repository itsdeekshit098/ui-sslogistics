export type WarrantyStatusFilter =
  | "all"
  | "active"
  | "expiring_soon"
  | "expired";

export interface WarrantyItem {
  id: number;
  repair_record_id: number | null;
  vehicle_id: number;
  part_name: string;
  vendor_id: number;
  cost: number;
  purchase_date: string;
  warranty_duration: number;
  warranty_duration_unit: "months" | "years";
  warranty_expiry: string;
  notes: string | null;
  created_at: string;
  warranty_status: "active" | "expiring_soon" | "expired";
  vendors: {
    id: number;
    name: string;
    phone: string | null;
    location: string | null;
  } | null;
  vehicles: {
    vehicle_number: string;
    company: string;
    model: string;
  } | null;
  repair_records: {
    id: number;
    repair_date: string;
    category: string;
    issues: string[];
    status: string;
  } | null;
}
