export interface VehicleTypeIconProps {
  /** CAR | BUS | TEMPO_TRAVELLER | TRUCK | CONTAINER */
  vehicleType: string | null | undefined;
  /** Only read for trucks: PICKUP_TRUCK, TIPPER_TRUCK, TANKER, TRAILER_TRUCK… */
  truckType?: string | null;
  /** Icon size in px; the tile around it stays 28px. */
  size?: number;
  className?: string;
}
