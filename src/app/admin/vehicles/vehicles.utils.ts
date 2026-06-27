import {
  Vehicle,
  VehicleType,
  VEHICLE_TYPES,
  TRUCK_TYPES,
  CONTAINER_LENGTHS,
  AXLE_TYPES,
  CONTAINER_BODY_TYPES,
  SEATING_CAPACITY_TYPES,
} from "./vehicles.types";

/** Strips spaces and lowercases for case-insensitive matching. */
const normalizeVehicleNumber = (value: string): string =>
  value.replace(/\s+/g, "").toLowerCase();

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

/** Returns the display label for a given vehicle type value. */
export const getVehicleTypeLabel = (value: string): string => {
  const found = VEHICLE_TYPES.find((t) => t.value === value);
  return found?.label ?? value;
};

/** Returns true if the vehicle type supports a seating capacity field. */
export const hasSeatingCapacity = (vehicleType: string): boolean =>
  SEATING_CAPACITY_TYPES.includes(vehicleType as VehicleType);

export const getDefaultVehicleFormData = (): Omit<Vehicle, "id"> => ({
  vehicle_number: "",
  vehicle_type: "",
  seating_capacity: null,
  company: "",
  model: "",
  status: "Active",
  last_service_date: "",
  truck_type: null,
  container_length: null,
  axle_type: null,
  container_body_type: null,
  rc_url: "",
  insurance_url: "",
  fc_url: "",
  permit_url: "",
  pollution_url: "",
  tax_url: "",
  expected_kml: null,
  tank_capacity: null,
  fuel_type: "DIESEL",
});

/** Returns the display label for a given truck_type value (e.g. "MINI_TRUCK" → "Mini Truck"). */
export const getTruckTypeLabel = (value: string | null | undefined): string => {
  if (!value) return "—";
  const found = TRUCK_TYPES.find((t) => t.value === value);
  return found?.label ?? value;
};

/** Returns the display label for a given container_length value (e.g. "32_FT" → "32 ft"). */
export const getContainerLengthLabel = (value: string | null | undefined): string => {
  if (!value) return "";
  const found = CONTAINER_LENGTHS.find((t) => t.value === value);
  return found?.label ?? value;
};

/** Returns the display label for a given axle_type value (e.g. "MULTI_AXLE" → "Multi Axle (MXL)"). */
export const getAxleTypeLabel = (value: string | null | undefined): string => {
  if (!value) return "";
  const found = AXLE_TYPES.find((t) => t.value === value);
  return found?.label ?? value;
};

/** Returns the display label for a given container_body_type value (e.g. "CLOSED" → "Closed Container"). */
export const getContainerBodyTypeLabel = (
  value: string | null | undefined,
): string => {
  if (!value) return "";
  const found = CONTAINER_BODY_TYPES.find((t) => t.value === value);
  return found?.label ?? value;
};

/**
 * Returns a formatted sub-detail string for a vehicle, used in the
 * table "Details" column and mobile card sub-line.
 *
 * - CAR / BUS / TEMPO_TRAVELLER → "5-Seater" or "—"
 * - TRUCK                       → truck_type label or "—"
 * - CONTAINER                   → "32 ft - Multi Axle - Closed" or "—"
 */
export const getVehicleSubDetail = (vehicle: Vehicle): string => {
  const type = vehicle.vehicle_type as VehicleType;

  if (SEATING_CAPACITY_TYPES.includes(type)) {
    return vehicle.seating_capacity ? `${vehicle.seating_capacity}-Seater` : "—";
  }

  if (type === "TRUCK") {
    return getTruckTypeLabel(vehicle.truck_type);
  }

  if (type === "CONTAINER") {
    const parts = [
      getContainerLengthLabel(vehicle.container_length),
      getAxleTypeLabel(vehicle.axle_type),
      getContainerBodyTypeLabel(vehicle.container_body_type),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" - ") : "—";
  }

  return "—";
};
