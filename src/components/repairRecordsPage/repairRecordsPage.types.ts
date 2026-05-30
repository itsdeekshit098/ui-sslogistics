export type RepairCategory = "electrical" | "mechanical";
export type RepairStatus = "Open" | "Closed";
export type WarrantyDurationUnit = "months" | "years";

export interface Vendor {
  id: number;
  name: string;
  phone: string | null;
  location: string | null;
}

export interface RepairPart {
  id: number;
  repair_record_id: number | null;
  vehicle_id: number;
  part_name: string;
  vendor_id: number;
  cost: number;
  purchase_date: string;
  warranty_duration: number;
  warranty_duration_unit: WarrantyDurationUnit;
  warranty_expiry: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  vendors?: Vendor | Vendor[];
}

export interface RepairPartInput {
  id?: number;
  part_name: string;
  vendor_id: number;
  cost: number;
  purchase_date: string;
  warranty_duration: number;
  warranty_duration_unit: WarrantyDurationUnit;
  warranty_expiry?: string;
  notes?: string;
}

export interface RepairRecord {
  id: number;
  vehicle_id: number;
  repair_date: string;
  category: RepairCategory;
  issues: string[];
  description: string | null;
  cost: number;
  status: RepairStatus;
  technician_id: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepairRecordWithVehicle extends RepairRecord {
  vehicles?: {
    vehicle_number: string;
    company: string;
    model: string;
  };
  technicians?: {
    id: number;
    name: string;
    phone: string | null;
    specializations: string[];
  };
  parts?: RepairPart[];
}

export interface CreateRepairPayload {
  vehicle_id: number;
  repair_date: string;
  category: RepairCategory;
  issues: string[];
  description?: string;
  cost: number;
  technician_id: number;
  parts?: RepairPartInput[];
}

export interface UpdateRepairPayload {
  id: number;
  description?: string;
  cost?: number;
  technician_id?: number;
  status?: RepairStatus;
  issues?: string[];
  parts?: RepairPartInput[];
}

export interface RepairFormData {
  vehicleId: string;
  category: RepairCategory | null;
  issues: string[];
  date: string;
  technicianId: string;
  cost: string;
  description: string;
  status: RepairStatus;
}

export const getDefaultRepairFormData = (): RepairFormData => ({
  vehicleId: "",
  category: null,
  issues: [],
  date: new Date().toISOString().split("T")[0],
  technicianId: "",
  cost: "",
  description: "",
  status: "Open",
});

// REPAIR_OPTIONS has been moved to the backend and is fetched dynamically.

export interface RepairSummary {
  totalCount: number;
  totalCost: number;
  electricalCost: number;
  mechanicalCost: number;
  openCount: number;
  closedCount: number;
}
