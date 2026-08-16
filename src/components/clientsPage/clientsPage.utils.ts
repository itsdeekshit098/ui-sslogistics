import {
  AXLE_TYPES,
  CONTAINER_BODY_TYPES,
  CONTAINER_LENGTHS,
  TRUCK_TYPES,
  VEHICLE_TYPES,
} from "@/app/admin/vehicles/vehicles.types";
import type { ClientDeployment } from "./clientsPage.types";

// Deployment specs reuse the vehicles module's enums and labels, so a
// 43-seater bus or a 32ft closed container reads identically on a client page
// and on the vehicles page.

function labelFrom(
  options: readonly { value: string; label: string }[],
  value: string | null,
): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

export function getVehicleTypeLabel(value: string): string {
  return labelFrom(VEHICLE_TYPES, value) ?? value;
}

/**
 * One-line description of what a deployment actually is, with the sub-fields
 * that matter for that type — "Bus · 43-seater", "Container · 32 ft · Closed".
 */
export function describeDeployment(deployment: ClientDeployment): string {
  const parts: string[] = [getVehicleTypeLabel(deployment.vehicle_type)];

  if (deployment.seating_capacity) {
    parts.push(`${deployment.seating_capacity}-seater`);
  }
  const truck = labelFrom(TRUCK_TYPES, deployment.truck_type);
  if (truck) parts.push(truck);

  const length = labelFrom(CONTAINER_LENGTHS, deployment.container_length);
  if (length) parts.push(length);

  const bodyType = labelFrom(CONTAINER_BODY_TYPES, deployment.container_body_type);
  if (bodyType) parts.push(bodyType);

  const axle = labelFrom(AXLE_TYPES, deployment.axle_type);
  if (axle) parts.push(axle);

  return parts.join(" · ");
}

/** "4 × Bus · 2 × Container" — the fleet mix as one readable line. */
export function describeFleetMix(mix: Record<string, number>): string {
  const entries = Object.entries(mix).filter(([, count]) => count > 0);
  if (entries.length === 0) return "";
  return entries
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => `${count} × ${getVehicleTypeLabel(type)}`)
    .join(" · ");
}

/**
 * How a client's position reads: money owed to us, money held on their
 * account, or square. Keeps the negative-outstanding case from ever surfacing
 * as a confusing minus sign.
 */
export function balanceTone(outstanding: number, advance: number): {
  label: string;
  tone: "owed" | "advance" | "clear";
} {
  if (advance > 0) return { label: "Advance", tone: "advance" };
  if (outstanding > 0) return { label: "Outstanding", tone: "owed" };
  return { label: "Settled", tone: "clear" };
}
