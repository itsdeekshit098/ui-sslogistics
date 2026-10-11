import { createElement } from "react";
import {
  BusIcon,
  CarIcon,
  CargoTruckIcon,
  ContainerTruckIcon,
  DumpTruckIcon,
  PickupTruckIcon,
  TankerTruckIcon,
  TrailerTruckIcon,
  VanIcon,
} from "@/components/ui/icon";
import type { ComponentIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { VehicleTypeIconProps } from "./vehicleTypeIcon.types";

const TYPE_ICONS: Record<string, ComponentIcon> = {
  CAR: CarIcon,
  BUS: BusIcon,
  TEMPO_TRAVELLER: VanIcon,
  TRUCK: CargoTruckIcon,
  CONTAINER: ContainerTruckIcon,
};

// A truck's sub-type picks a more exact drawing where one exists; the weight
// classes (LCV / MCV / HCV) and mini trucks fall back to the plain truck.
const TRUCK_ICONS: Record<string, ComponentIcon> = {
  PICKUP_TRUCK: PickupTruckIcon,
  TIPPER_TRUCK: DumpTruckIcon,
  TANKER: TankerTruckIcon,
  TRAILER_TRUCK: TrailerTruckIcon,
};

/** The icon component for a vehicle, from its type and (for trucks) sub-type. */
export function vehicleTypeIcon(
  vehicleType: string | null | undefined,
  truckType?: string | null,
): ComponentIcon {
  if (vehicleType === "TRUCK" && truckType && TRUCK_ICONS[truckType]) {
    return TRUCK_ICONS[truckType];
  }
  return (vehicleType && TYPE_ICONS[vehicleType]) || CargoTruckIcon;
}

/**
 * A vehicle's icon in a small tinted tile — what kind of vehicle a row is,
 * readable before the label is.
 */
export function VehicleTypeIcon({
  vehicleType,
  truckType,
  size = 16,
  className,
}: VehicleTypeIconProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground",
        className,
      )}
    >
      {createElement(vehicleTypeIcon(vehicleType, truckType), { size })}
    </span>
  );
}
