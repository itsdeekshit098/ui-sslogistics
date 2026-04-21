import { Vehicle, VehicleType, VEHICLE_TYPES } from "./vehicles.types";

/**
 * Normalizes a vehicle number by removing spaces and converting to lowercase.
 * Used for search matching against partial user inputs.
 */
export const normalizeVehicleNumber = (value: string): string =>
  value.replace(/\s+/g, "").toLowerCase();

/**
 * Filters vehicles by search query and vehicle type.
 * - Search is case-insensitive and ignores spaces in vehicle numbers.
 * - Supports partial substring matching (e.g. "3465", "KJ", "AP39").
 * - Filter and search work together (combined filtering).
 */
export const filterVehicles = (
  vehicles: Vehicle[],
  searchQuery: string,
  typeFilter: VehicleType | "all",
): Vehicle[] => {
  const normalizedQuery = normalizeVehicleNumber(searchQuery);

  return vehicles.filter((vehicle) => {
    const matchesType =
      typeFilter === "all" || vehicle.vehicle_type === typeFilter;

    const matchesSearch =
      normalizedQuery === "" ||
      normalizeVehicleNumber(vehicle.vehicle_number).includes(normalizedQuery);

    return matchesType && matchesSearch;
  });
};

/**
 * Extracts unique vehicle types from the dataset.
 */
export const getUniqueVehicleTypes = (vehicles: Vehicle[]): string[] => {
  const types = new Set(vehicles.map((v) => v.vehicle_type));
  return VEHICLE_TYPES.filter((t) => types.has(t));
};

/**
 * Returns highlight segments for a vehicle number based on the search query.
 * Returns an array of { text, highlighted } segments for rendering.
 */
export const getHighlightSegments = (
  vehicleNumber: string,
  searchQuery: string,
): { text: string; highlighted: boolean }[] => {
  if (!searchQuery.trim()) {
    return [{ text: vehicleNumber, highlighted: false }];
  }

  const normalizedNumber = normalizeVehicleNumber(vehicleNumber);
  const normalizedQuery = normalizeVehicleNumber(searchQuery);
  const matchIndex = normalizedNumber.indexOf(normalizedQuery);

  if (matchIndex === -1) {
    return [{ text: vehicleNumber, highlighted: false }];
  }

  // Map normalized indices back to original string indices
  let normalizedPos = 0;
  let originalStart = -1;
  let originalEnd = -1;

  for (let i = 0; i < vehicleNumber.length; i++) {
    if (vehicleNumber[i] !== " ") {
      if (normalizedPos === matchIndex) originalStart = i;
      if (normalizedPos === matchIndex + normalizedQuery.length - 1) {
        originalEnd = i + 1;
        break;
      }
      normalizedPos++;
    }
  }

  if (originalStart === -1 || originalEnd === -1) {
    return [{ text: vehicleNumber, highlighted: false }];
  }

  const segments: { text: string; highlighted: boolean }[] = [];
  if (originalStart > 0) {
    segments.push({
      text: vehicleNumber.slice(0, originalStart),
      highlighted: false,
    });
  }
  segments.push({
    text: vehicleNumber.slice(originalStart, originalEnd),
    highlighted: true,
  });
  if (originalEnd < vehicleNumber.length) {
    segments.push({
      text: vehicleNumber.slice(originalEnd),
      highlighted: false,
    });
  }

  return segments;
};

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
  tax_url: "",
});
