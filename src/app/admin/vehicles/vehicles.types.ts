export type VehicleStatus = "Active" | "Maintenance" | "Idle" | string;

export interface Vehicle {
    id: number;
    vehicle_number: string;
    vehicle_type: string;
    capacity: string;
    company: string;
    model: string;
    status: VehicleStatus;
    last_service_date: string | null;
    rc_url?: string;
    insurance_url?: string;
    fc_url?: string;
    permit_url?: string;
    pollution_url?: string;
    tax_url?: string;
    created_at?: string;
    updated_at?: string;
}
