"use client";

import React, { useEffect, useState } from "react";
import { SaveIcon } from "@ui/icons";
import { Button } from "@ui/components/button";
import { FormField } from "@ui/components/formField";
import { FormGrid } from "@ui/components/formGrid";
import { Alert } from "@ui/components/alert";
import { DatePicker } from "@ui/components/datePicker";
import { MoneyInput } from "@ui/components/moneyInput";
import { NumberInput } from "@ui/components/numberInput";
import { Combobox } from "@ui/components/combobox";
import { Spinner } from "@ui/components/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/select";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@ui/components/modal";
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
import { todayInIndia } from "@/lib/dateOnly";

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
  const [quantity, setQuantity] = useState<number | null>(deploymentToEdit?.quantity ?? 1);
  const [vehicleType, setVehicleType] = useState<string>(
    deploymentToEdit?.vehicle_type ?? "",
  );
  const [seatingCapacity, setSeatingCapacity] = useState<number | null>(
    deploymentToEdit?.seating_capacity || null,
  );
  const [truckType, setTruckType] = useState(deploymentToEdit?.truck_type ?? "");
  const [containerLength, setContainerLength] = useState(
    deploymentToEdit?.container_length ?? "",
  );
  const [axleType, setAxleType] = useState(deploymentToEdit?.axle_type ?? "");
  const [containerBodyType, setContainerBodyType] = useState(
    deploymentToEdit?.container_body_type ?? "",
  );
  const [monthlyRate, setMonthlyRate] = useState<number | null>(
    deploymentToEdit?.monthly_rate ?? null,
  );
  const [startDate, setStartDate] = useState<string | null>(deploymentToEdit?.start_date ?? null);
  const [endDate, setEndDate] = useState<string | null>(deploymentToEdit?.end_date ?? null);
  // The business day in India, for the calendar's "Today" and highlight.
  const today = todayInIndia();

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
      if (quantity == null || quantity < 1) {
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
            quantity,
            vehicle_type: vehicleType,
            seating_capacity: needsSeating ? seatingCapacity : null,
            truck_type: isTruck ? truckType : null,
            container_length: isContainer ? containerLength : null,
            axle_type: isContainer ? axleType : null,
            container_body_type: isContainer ? containerBodyType : null,
          };

    payload.monthly_rate = monthlyRate;
    payload.start_date = startDate;
    payload.end_date = endDate;

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

        <FormGrid>
          {mode === "linked" ? (
            <FormField
              className="sm:col-span-2"
              label="Vehicle"
              required
              htmlFor="deployment-vehicle"
              hint="Its type, seating and body details come across automatically."
            >
              <Combobox<FleetVehicle>
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
            </FormField>
          ) : (
            <>
              <FormField label="Vehicle Type" required htmlFor="deployment-type">
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
              </FormField>

              <FormField label="How Many" required>
                {(control) => (
                  <NumberInput
                    {...control}
                    disabled={loading}
                    value={quantity}
                    onValueChange={setQuantity}
                  />
                )}
              </FormField>

              {needsSeating && (
                <FormField label="Seating Capacity">
                  {(control) => (
                    <NumberInput
                      {...control}
                      disabled={loading}
                      placeholder="e.g. 43"
                      value={seatingCapacity}
                      onValueChange={setSeatingCapacity}
                    />
                  )}
                </FormField>
              )}

              {isTruck && (
                <FormField label="Truck Type" required htmlFor="deployment-truck-type">
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
                </FormField>
              )}

              {isContainer && (
                <>
                  <FormField label="Length" required htmlFor="deployment-length">
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
                  </FormField>

                  <FormField label="Body Type" required htmlFor="deployment-body">
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
                  </FormField>

                  <FormField label="Axle Type" required htmlFor="deployment-axle">
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
                  </FormField>
                </>
              )}
            </>
          )}

          <FormField label="Monthly Rate (₹)">
            {(control) => (
              <MoneyInput
                {...control}
                disabled={loading}
                min={0}
                placeholder="Per vehicle"
                value={monthlyRate}
                onValueChange={setMonthlyRate}
              />
            )}
          </FormField>

          <FormField label="Deployed From">
            {(control) => (
              <DatePicker
                {...control}
                today={today}
                clearable
                disabled={loading}
                value={startDate}
                onValueChange={setStartDate}
              />
            )}
          </FormField>

          <FormField label="Until">
            {(control) => (
              <DatePicker
                {...control}
                today={today}
                clearable
                disabled={loading}
                value={endDate}
                onValueChange={setEndDate}
              />
            )}
          </FormField>
        </FormGrid>

        {error && (
          <Alert tone="danger" className="mt-4" scrollIntoView>
            {error}
          </Alert>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <Spinner size="sm" className="mr-2" />
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
