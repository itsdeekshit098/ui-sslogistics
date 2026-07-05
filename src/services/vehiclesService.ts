import type { Vehicle } from "@/app/admin/vehicles/vehicles.types";

/**
 * Client-side transport layer for `/api/vehicles`.
 *
 * This is the only place in the web client that knows the request/response
 * shape of the vehicles API routes. Centralizing it here means:
 *  - createVehicleModal / editVehicleModal never construct fetch() calls
 *    directly, so the two flows can't drift apart on headers, payload shape,
 *    or error parsing.
 *  - the same contract documented here is exactly what the mobile app talks
 *    to, since both clients hit the same Next.js API route handlers.
 */

export type VehiclePayload = Omit<Vehicle, "id">;

export interface VehicleServiceResult {
  success: boolean;
  error?: string;
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const json = await res.json();
    return json?.error || res.statusText || "Unexpected error";
  } catch {
    return res.statusText || "Unexpected error";
  }
}

export async function createVehicle(
  payload: VehiclePayload,
): Promise<VehicleServiceResult> {
  try {
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Failed to save vehicle: ${await extractErrorMessage(res)}`,
      };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Error saving vehicle: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function updateVehicle(
  id: number,
  payload: VehiclePayload,
): Promise<VehicleServiceResult> {
  try {
    const res = await fetch("/api/vehicles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Failed to update vehicle: ${await extractErrorMessage(res)}`,
      };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Unexpected error updating vehicle." };
  }
}

export async function deleteVehicle(
  id: number,
): Promise<VehicleServiceResult> {
  try {
    const res = await fetch(`/api/vehicles?id=${id}`, { method: "DELETE" });

    if (!res.ok) {
      return {
        success: false,
        error: `Failed to delete vehicle: ${await extractErrorMessage(res)}`,
      };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Unexpected error deleting vehicle." };
  }
}
