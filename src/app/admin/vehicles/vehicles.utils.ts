import { Vehicle } from "./vehicles.types";

export const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case "Active":
            return "default";
        case "Maintenance":
            return "destructive";
        case "Idle":
            return "secondary";
        default:
            return "outline";
    }
};

export const getDefaultVehicleFormData = (): Omit<Vehicle, "id"> => ({
    vehicle_number: "",
    vehicle_type: "",
    capacity: "",
    company: "",
    model: "",
    status: "Active",
    last_service_date: "",
    rc_url: "",
    insurance_url: "",
    fc_url: "",
    permit_url: "",
    pollution_url: "",
    tax_url: ""
});
