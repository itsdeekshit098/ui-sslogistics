export type RepairCategory = "electrical" | "mechanical";
export type RepairStatus = "Open" | "Closed";

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
}

export interface CreateRepairPayload {
  vehicle_id: number;
  repair_date: string;
  category: RepairCategory;
  issues: string[];
  description?: string;
  cost: number;
  technician_id: number;
}

export interface UpdateRepairPayload {
  id: number;
  description?: string;
  cost?: number;
  technician_id?: number;
  status?: RepairStatus;
  issues?: string[];
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

export const REPAIR_OPTIONS: Record<RepairCategory, readonly string[]> = {
  electrical: [
    "Battery",
    "Lights",
    "Self Motor",
    "Alternator",
    "Wiring",
    "Fuses",
    "Horn",
    "Indicators",
  ],
  mechanical: [
    "Engine",
    "Brakes",
    "Clutch",
    "Suspension",
    "Gearbox",
    "Tyres",
    "Oil Service",
    "Coolant System",
  ],
} as const;

export interface RepairSummary {
  totalCount: number;
  totalCost: number;
  electricalCost: number;
  mechanicalCost: number;
  openCount: number;
  closedCount: number;
}
