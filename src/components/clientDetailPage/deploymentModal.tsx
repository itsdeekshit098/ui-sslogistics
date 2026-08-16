"use client";

import React, { useEffect, useState } from "react";
import { SaveIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Typeahead } from "@/components/typeahead";
import { LoadingSpinner } from "@/components/loadingSpinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import {
  AXLE_TYPES,
  CONTAINER_BODY_TYPES,
  CONTAINER_LENGTHS,
  SEATING_CAPACITY_TYPES,
  TRUCK_TYPES,
  VEHICLE_TYPES,
  type VehicleType,
} from "@/app/admin/vehicles/vehicles.types";
import type { ClientDeployment } from "@/components/clientsPage/clientsPage.types";

export interface DeploymentModalProps {
  isOpen: boolean;
  clientId: number;
  deploymentToEdit?: ClientDeployment | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FleetVehicle {
  id: number;
  vehicle_number: string;
  vehicle_type: string;
  company: string | null;
  model: string | null;
}

type Mode = "linked" | "declared";

const DeploymentForm: React.FC<Omit<DeploymentModalProps, "isOpen">> = ({
  clientId,
  deploymentToEdit,
  onClose,
  onSuccess,
}) => {
  const isEdit = !!deploymentToEdit;

  // Two ways to describe what runs for a client: pick one of our vehicles, or
  // declare a count of a spec we don't track individually.
  const [mode, setMode] = useState<Mode>(
    deploymentToEdit?.vehicle_id ? "linked" : "declared",
  );
  const [vehicleId, setVehicleId] = useState(
    deploymentToEdit?.vehicle_id ? String(deploymentToEdit.vehicle_id) : "",
  );
  const [quantity, setQuantity] = useState(String(deploymentToEdit?.quantity ?? 1));
  const [vehicleType, setVehicleType] = useState<string>(
    deploymentToEdit?.vehicle_type ?? "",
  );
  const [seatingCapacity, setSeatingCapacity] = useState(
    deploymentToEdit?.seating_capacity ? String(deploymentToEdit.seating_capacity) : "",
  );
  const [truckType, setTruckType] = useState(deploymentToEdit?.truck_type ?? "");
  const [containerLength, setContainerLength] = useState(
    deploymentToEdit?.container_length ?? "",
  );
  const [axleType, setAxleType] = useState(deploymentToEdit?.axle_type ?? "");
  const [containerBodyType, setContainerBodyType] = useState(
    deploymentToEdit?.container_body_type ?? "",
  );
  const [monthlyRate, setMonthlyRate] = useState(
    deploymentToEdit?.monthly_rate != null ? String(deploymentToEdit.monthly_rate) : "",
  );
  const [startDate, setStartDate] = useState(deploymentToEdit?.start_date ?? "");
  const [endDate, setEndDate] = useState(deploymentToEdit?.end_date ?? "");

  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The fleet is fetched the first time "Pick from our fleet" is chosen. Until
  // it arrives the picker says so — an empty list otherwise reads as "we have
  // no vehicles".
  useEffect(() => {
    if (mode !== "linked" || vehicles.length > 0) return;
    (async () => {
      setVehiclesLoading(true);
      try {
        const res = await fetch("/api/vehicles?page=1&pageSize=500");
        const json = await res.json();
        if (res.ok) setVehicles(json.data?.data ?? json.data ?? []);
        else setError(json.error || "Couldn't load the vehicle list");
      } catch {
        setError("Couldn't load the vehicle list");
      } finally {
        setVehiclesLoading(false);
      }
    })();
  }, [mode, vehicles.length]);

  const needsSeating = (SEATING_CAPACITY_TYPES as string[]).includes(vehicleType);
  const isTruck = vehicleType === "TRUCK";
  const isContainer = vehicleType === "CONTAINER";

  const handleSubmit = async () => {
    if (mode === "linked" && !vehicleId) {
      setError("Choose a vehicle");
      return;
    }
    if (mode === "declared") {
      if (!vehicleType) {
        setError("Choose a vehicle type");
        return;
      }
      if (isTruck && !truckType) {
        setError("Choose a truck type");
        return;
      }
      if (isContainer && (!containerLength || !axleType || !containerBodyType)) {
        setError("Container length, axle type and body type are all required");
        return;
      }
      if (!quantity || Number(quantity) < 1) {
        setError("Quantity must be at least 1");
        return;
      }
    }

    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> =
      mode === "linked"
        ? // The spec is copied from the vehicle server-side, so it can't
          // describe something the vehicle isn't.
          { vehicle_id: Number(vehicleId) }
        : {
            vehicle_id: null,
            quantity: Number(quantity),
            vehicle_type: vehicleType,
            seating_capacity: needsSeating && seatingCapacity ? Number(seatingCapacity) : null,
            truck_type: isTruck ? truckType : null,
            container_length: isContainer ? containerLength : null,
            axle_type: isContainer ? axleType : null,
            container_body_type: isContainer ? containerBodyType : null,
          };

    payload.monthly_rate = monthlyRate ? Number(monthlyRate) : null;
    payload.start_date = startDate || null;
    payload.end_date = endDate || null;

    if (isEdit) payload.id = deploymentToEdit!.id;

    try {
      const res = await fetch(`/api/clients/${clientId}/deployments`, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(json.error || "Failed to save");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ModalHeader>
        <ModalTitle>{isEdit ? "Edit Vehicle" : "Add Vehicle"}</ModalTitle>
        <ModalDescription>
          Record what runs for this client — either one of our own vehicles, or
          a count of a type we don&rsquo;t track individually.
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="mb-4 flex gap-2">
          <Button
            type="button"
            variant={mode === "linked" ? "default" : "outline"}
            size="sm"
            disabled={loading}
            onClick={() => setMode("linked")}
          >
            Pick from our fleet
          </Button>
          <Button
            type="button"
            variant={mode === "declared" ? "default" : "outline"}
            size="sm"
            disabled={loading}
            onClick={() => setMode("declared")}
          >
            Describe by type
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {mode === "linked" ? (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="deployment-vehicle">
                Vehicle <span className="text-destructive">*</span>
              </Label>
              <Typeahead<FleetVehicle>
                id="deployment-vehicle"
                options={vehicles}
                value={vehicleId}
                onValueChange={(val) => {
                  setVehicleId(val);
                  setError(null);
                }}
                getOptionLabel={(v) => v.vehicle_number}
                getOptionValue={(v) => String(v.id)}
                getOptionDescription={(v) =>
                  [v.company, v.model].filter(Boolean).join(" ")
                }
                placeholder={vehiclesLoading ? "Loading…" : "Search vehicles..."}
                emptyMessage="No vehicles found."
                disabled={loading || vehiclesLoading}
                clearable
              />
              <span className="text-xs text-muted-foreground">
                Its type, seating and body details come across automatically.
              </span>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="deployment-type">
                  Vehicle Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  disabled={loading}
                  value={vehicleType}
                  onValueChange={(val) => {
                    setVehicleType(val as VehicleType);
                    setError(null);
                  }}
                >
                  <SelectTrigger id="deployment-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="deployment-quantity">
                  How Many <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="deployment-quantity"
                  type="number"
                  min={1}
                  disabled={loading}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              {needsSeating && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="deployment-seating">Seating Capacity</Label>
                  <Input
                    id="deployment-seating"
                    type="number"
                    min={1}
                    disabled={loading}
                    placeholder="e.g. 43"
                    value={seatingCapacity}
                    onChange={(e) => setSeatingCapacity(e.target.value)}
                  />
                </div>
              )}

              {isTruck && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="deployment-truck-type">
                    Truck Type <span className="text-destructive">*</span>
                  </Label>
                  <Select disabled={loading} value={truckType} onValueChange={setTruckType}>
                    <SelectTrigger id="deployment-truck-type">
                      <SelectValue placeholder="Select truck type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRUCK_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isContainer && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="deployment-length">
                      Length <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      disabled={loading}
                      value={containerLength}
                      onValueChange={setContainerLength}
                    >
                      <SelectTrigger id="deployment-length">
                        <SelectValue placeholder="Select length" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTAINER_LENGTHS.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="deployment-body">
                      Body Type <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      disabled={loading}
                      value={containerBodyType}
                      onValueChange={setContainerBodyType}
                    >
                      <SelectTrigger id="deployment-body">
                        <SelectValue placeholder="Select body type" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTAINER_BODY_TYPES.map((b) => (
                          <SelectItem key={b.value} value={b.value}>
                            {b.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="deployment-axle">
                      Axle Type <span className="text-destructive">*</span>
                    </Label>
                    <Select disabled={loading} value={axleType} onValueChange={setAxleType}>
                      <SelectTrigger id="deployment-axle">
                        <SelectValue placeholder="Select axle type" />
                      </SelectTrigger>
                      <SelectContent>
                        {AXLE_TYPES.map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="deployment-rate">Monthly Rate (₹)</Label>
            <Input
              id="deployment-rate"
              type="number"
              disabled={loading}
              placeholder="Per vehicle"
              value={monthlyRate}
              onChange={(e) => setMonthlyRate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="deployment-start">Deployed From</Label>
            <Input
              id="deployment-start"
              type="date"
              disabled={loading}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="deployment-end">Until</Label>
            <Input
              id="deployment-end"
              type="date"
              disabled={loading}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
          )}
          {loading ? "Saving..." : isEdit ? "Update" : "Add"}
        </Button>
      </ModalFooter>
    </>
  );
};

export const DeploymentModal: React.FC<DeploymentModalProps> = ({ isOpen, ...rest }) => (
  <Modal open={isOpen} onOpenChange={(open) => !open && rest.onClose()}>
    <ModalContent style={{ maxWidth: "40rem", padding: 0 }}>
      {isOpen && <DeploymentForm {...rest} />}
    </ModalContent>
  </Modal>
);

export default DeploymentModal;
