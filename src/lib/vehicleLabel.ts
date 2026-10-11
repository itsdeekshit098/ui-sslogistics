/**
 * "KA428059 — EICHER PRO 2110" for vehicle pickers. Make and model are both
 * optional on a vehicle; a missing one is left out rather than printed as
 * the word "null".
 */
export function vehicleLabel(vehicle: {
  vehicle_number: string;
  company?: string | null;
  model?: string | null;
}): string {
  const makeAndModel = [vehicle.company, vehicle.model].filter(Boolean).join(" ");
  return makeAndModel ? `${vehicle.vehicle_number} — ${makeAndModel}` : vehicle.vehicle_number;
}
