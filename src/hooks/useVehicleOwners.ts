"use client";

import { useCallback, useEffect, useState } from "react";
import { VehicleOwner } from "@/app/admin/vehicles/vehicles.types";

/**
 * Owners lookup shared by the create/edit vehicle modals, backed by a
 * module-level promise cache so reopening a modal doesn't refetch a
 * rarely-changing table (and concurrent mounts share one request).
 * Mutations elsewhere (the Vehicle Owners page) must call
 * invalidateVehicleOwnersCache() so the next mount refetches.
 */
let ownersPromise: Promise<VehicleOwner[]> | null = null;

function loadOwners(): Promise<VehicleOwner[]> {
  ownersPromise ??= fetch("/api/vehicle-owners")
    .then((r) => r.json())
    .then((d) => {
      if (!d.success) throw new Error("Failed to load owners");
      return d.data as VehicleOwner[];
    })
    .catch(() => {
      // Don't cache failures — retry on the next mount.
      ownersPromise = null;
      return [];
    });
  return ownersPromise;
}

export function invalidateVehicleOwnersCache() {
  ownersPromise = null;
}

export function useVehicleOwners() {
  const [owners, setOwners] = useState<VehicleOwner[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadOwners().then((list) => {
      if (!cancelled) setOwners(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Registers an owner created inline (via AddVehicleOwnerModal). */
  const addOwner = useCallback((owner: VehicleOwner) => {
    if (ownersPromise) {
      ownersPromise = ownersPromise.then((list) => [...list, owner]);
    }
    setOwners((prev) => [...prev, owner]);
  }, []);

  return { owners, addOwner };
}
