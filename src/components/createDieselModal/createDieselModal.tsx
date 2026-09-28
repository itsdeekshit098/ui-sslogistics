"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CreateDieselModalProps } from "./createDieselModal.types";
import { SaveIcon, AlertTriangleIcon, UserPlusIcon } from "@/components/ui/icon";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { Typeahead } from "@/components/typeahead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
} from "@/components/ui/modal";
import { AddDriverModal } from "@/components/addDriverModal";
import type { Driver } from "@/components/driversPage/driversPage.types";
import type {
  FillType,
  PaymentMethod,
} from "@/app/admin/diesel-records/dieselRecords.types";

const MODAL_GRID = "grid grid-cols-1 sm:grid-cols-2 gap-4";
const MODAL_LABEL_SPACE = "space-y-2";

const getDefaultFormData = () => ({
  date: new Date().toISOString().split("T")[0],
  time: new Date().toTimeString().split(" ")[0].substring(0, 5),
  vehicleId: "",
  driverName: "",
  fillType: "full" as FillType,
  fuelLitres: "",
  pricePerL: "",
  currentOdo: "",
  station: "",
  paymentMethod: "" as PaymentMethod | "",
  receiptNumber: "",
  notes: "",
});

/**
 * Inner form — mounts/unmounts with modal visibility so state resets naturally.
 */
const CreateDieselForm: React.FC<{
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  vehicles: CreateDieselModalProps["vehicles"];
  defaultVehicleId?: string;
}> = ({ onClose, onSuccess, vehicles, defaultVehicleId }) => {
  const [formData, setFormData] = useState(() => ({
    ...getDefaultFormData(),
    vehicleId: defaultVehicleId ?? "",
  }));
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [driversList, setDriversList] = useState<Driver[]>([]);
  const [showAddDriver, setShowAddDriver] = useState(false);

  useEffect(() => {
    fetch("/api/drivers?pageSize=100")
      .then((res) => res.json())
      .then((json) => {
        const arr = json.data?.data ?? json.data;
        if (Array.isArray(arr)) setDriversList(arr);
      })
      .catch(() => {});
  }, []);

  const handleDriverAdded = (newDriver: Driver) => {
    setDriversList((prev) => [...prev, newDriver]);
    setFormData((prev) => ({ ...prev, driverName: newDriver.name }));
    setShowAddDriver(false);
  };

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showAddDriver) handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, showAddDriver]);

  const selectedVehicle = vehicles.find(
    (v) => v.id.toString() === formData.vehicleId,
  );

  // Client-side warnings
  const warnings = useMemo(() => {
    const w: string[] = [];
    const litres = parseFloat(formData.fuelLitres);
    const tank = selectedVehicle?.tank_capacity;
    if (tank && litres > tank) {
      w.push(`Fuel (${litres}L) exceeds tank capacity (${tank}L)`);
    }
    if (
      formData.fillType === "full" &&
      tank &&
      litres < tank * 0.3 &&
      litres > 0
    ) {
      w.push(
        `Only ${litres}L for a full fill? Tank capacity is ${tank}L. Are you sure?`,
      );
    }
    return w;
  }, [formData.fuelLitres, formData.fillType, selectedVehicle?.tank_capacity]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setSubmitError(null);
    setFieldErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!formData.date) errors.date = "Date is required";
    if (!formData.time) errors.time = "Time is required";
    if (!formData.vehicleId) errors.vehicleId = "Vehicle is required";
    if (!formData.driverName.trim())
      errors.driverName = "Driver name is required";
    if (!formData.currentOdo) errors.currentOdo = "Odometer is required";
    else if (parseFloat(formData.currentOdo) < 0)
      errors.currentOdo = "Must be ≥ 0";
    if (!formData.fuelLitres) errors.fuelLitres = "Fuel is required";
    else if (parseFloat(formData.fuelLitres) <= 0)
      errors.fuelLitres = "Must be > 0";
    if (formData.pricePerL && parseFloat(formData.pricePerL) < 0)
      errors.pricePerL = "Must be ≥ 0";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitError("Please fix the validation errors above.");
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const fillDate = new Date(
        `${formData.date}T${formData.time}:00`,
      ).toISOString();

      const payload = {
        vehicle_id: parseInt(formData.vehicleId),
        driver_name: formData.driverName,
        fill_date: fillDate,
        fill_type: formData.fillType,
        fuel_litres: parseFloat(formData.fuelLitres),
        price_per_l: formData.pricePerL ? parseFloat(formData.pricePerL) : 0,
        current_odo: parseFloat(formData.currentOdo),
        station: formData.station || undefined,
        payment_method: formData.paymentMethod || undefined,
        receipt_number: formData.receiptNumber || undefined,
        notes: formData.notes || undefined,
      };

      const response = await fetch("/api/diesel-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        await onSuccess();
        setLoading(false);
        onClose();
      } else {
        setSubmitError(data.error || "Failed to save record");
        setLoading(false);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
      setLoading(false);
    }
  };

  const computedAmount =
    formData.fuelLitres && formData.pricePerL
      ? (
          parseFloat(formData.fuelLitres) * parseFloat(formData.pricePerL)
        ).toFixed(2)
      : null;

  return (
    <>
      <ModalHeader>
        <ModalTitle>New Diesel Entry</ModalTitle>
        <ModalDescription className="hidden sm:block">
          Record fuel consumption for a vehicle.
        </ModalDescription>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-6">
        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="bg-warning/10 border border-warning/20 px-4 py-3 rounded-md space-y-1">
            {warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-warning"
              >
                <AlertTriangleIcon size={16} className="shrink-0" />
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Date & Time */}
          <div className={MODAL_GRID}>
            <div className={MODAL_LABEL_SPACE}>
              <Label htmlFor="date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input disabled={loading}
                data-testid="components-createDieselModal-createDieselModal-input-1"
                id="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                className={
                  fieldErrors.date
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {fieldErrors.date && (
                <p className="text-xs text-destructive">{fieldErrors.date}</p>
              )}
            </div>
            <div className={MODAL_LABEL_SPACE}>
              <Label htmlFor="time">
                Time <span className="text-destructive">*</span>
              </Label>
              <Input disabled={loading}
                data-testid="components-createDieselModal-createDieselModal-input-2"
                id="time"
                type="time"
                value={formData.time}
                onChange={handleChange}
                className={
                  fieldErrors.time
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {fieldErrors.time && (
                <p className="text-xs text-destructive">{fieldErrors.time}</p>
              )}
            </div>
          </div>

          {/* Vehicle */}
          <div className={MODAL_LABEL_SPACE}>
            <Label htmlFor="vehicleId">
              Vehicle <span className="text-destructive">*</span>
            </Label>
            <Typeahead disabled={loading}
              id="vehicleId"
              data-testid="components-createDieselModal-createDieselModal-select-1"
              options={vehicles}
              value={formData.vehicleId}
              onValueChange={(vehicleId) => {
                setFormData((prev) => ({ ...prev, vehicleId }));
                setSubmitError(null);
                setFieldErrors((prev) => ({ ...prev, vehicleId: "" }));
              }}
              getOptionValue={(vehicle) => vehicle.id.toString()}
              getOptionLabel={(vehicle) =>
                `${vehicle.vehicle_number} — ${vehicle.company} ${vehicle.model}`.trim()
              }
              getOptionKeywords={(vehicle) => [
                vehicle.vehicle_number,
                vehicle.company,
                vehicle.model,
              ]}
              placeholder="Search vehicle..."
              emptyMessage="No vehicles found."
              invalid={Boolean(fieldErrors.vehicleId)}
            />
            {fieldErrors.vehicleId && (
              <p className="text-xs text-destructive">{fieldErrors.vehicleId}</p>
            )}
            {selectedVehicle && (
              <p className="text-xs text-muted-foreground">
                Tank: {selectedVehicle.tank_capacity ?? "—"}L · Exp Km/L:{" "}
                {selectedVehicle.expected_kml ?? "—"}
              </p>
            )}
          </div>

          {/* Driver */}
          <div className={MODAL_LABEL_SPACE}>
            <Label htmlFor="driverName">
              Driver Name <span className="text-destructive">*</span>
            </Label>
            <Typeahead disabled={loading}
              id="driverName"
              data-testid="components-createDieselModal-createDieselModal-driver-typeahead"
              options={driversList.filter((d) => d.is_active)}
              value={
                driversList.find((d) => d.name === formData.driverName)
                  ? String(
                      driversList.find((d) => d.name === formData.driverName)!
                        .id,
                    )
                  : ""
              }
              onValueChange={(_driverId, driver) => {
                const name = driver?.name ?? "";
                setFormData((prev) => ({ ...prev, driverName: name }));
                setFieldErrors((prev) => ({ ...prev, driverName: "" }));
                setSubmitError(null);
              }}
              getOptionValue={(d) => d.id.toString()}
              getOptionLabel={(d) => d.name}
              getOptionDescription={(d) =>
                [d.phone, d.place].filter(Boolean).join(" · ") || undefined
              }
              getOptionKeywords={(d) => [d.name, d.phone || "", d.place || ""]}
              placeholder="Search drivers..."
              emptyMessage="No drivers found."
              invalid={Boolean(fieldErrors.driverName)}
              footer={
                <Button
                  variant="ghost"
                  type="button"
                  className="flex items-center justify-start gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-muted transition-colors rounded-none h-auto"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={() => setShowAddDriver(true)}
                >
                  <UserPlusIcon size={14} />
                  Add New Driver
                </Button>
              }
            />
            {fieldErrors.driverName && (
              <p className="text-xs text-destructive">{fieldErrors.driverName}</p>
            )}
          </div>

          {/* Fill Type & Odometer */}
          <div className={MODAL_GRID}>
            <div className={MODAL_LABEL_SPACE}>
              <Label>
                Fill Type <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Button
                  data-testid="components-createDieselModal-createDieselModal-button-1"
                  type="button"
                  disabled={loading}
                  variant={formData.fillType === "full" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, fillType: "full" }))
                  }
                >
                  Full Fill
                </Button>
                <Button
                  data-testid="components-createDieselModal-createDieselModal-button-2"
                  type="button"
                  disabled={loading}
                  variant={
                    formData.fillType === "partial" ? "default" : "outline"
                  }
                  className="flex-1"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, fillType: "partial" }))
                  }
                >
                  Partial Fill
                </Button>
              </div>
            </div>
            <div className={MODAL_LABEL_SPACE}>
              <Label htmlFor="currentOdo">
                Current Odometer (km) <span className="text-destructive">*</span>
              </Label>
              <Input disabled={loading}
                data-testid="components-createDieselModal-createDieselModal-input-4"
                id="currentOdo"
                type="number"
                placeholder="0"
                min="0"
                value={formData.currentOdo}
                onChange={handleChange}
                onWheel={(e) => e.currentTarget.blur()}
                className={
                  fieldErrors.currentOdo
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {fieldErrors.currentOdo && (
                <p className="text-xs text-destructive">{fieldErrors.currentOdo}</p>
              )}
            </div>
          </div>

          {/* Fuel & Price */}
          <div className={MODAL_GRID}>
            <div className={MODAL_LABEL_SPACE}>
              <Label htmlFor="fuelLitres">
                Fuel Added (Litres) <span className="text-destructive">*</span>
              </Label>
              <Input disabled={loading}
                data-testid="components-createDieselModal-createDieselModal-input-5"
                id="fuelLitres"
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={formData.fuelLitres}
                onChange={handleChange}
                onWheel={(e) => e.currentTarget.blur()}
                className={
                  fieldErrors.fuelLitres
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {fieldErrors.fuelLitres && (
                <p className="text-xs text-destructive">{fieldErrors.fuelLitres}</p>
              )}
            </div>
            <div className={MODAL_LABEL_SPACE}>
              <Label htmlFor="pricePerL">Price per L (₹)</Label>
              <Input disabled={loading}
                data-testid="components-createDieselModal-createDieselModal-input-6"
                id="pricePerL"
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={formData.pricePerL}
                onChange={handleChange}
                onWheel={(e) => e.currentTarget.blur()}
                className={
                  fieldErrors.pricePerL
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {fieldErrors.pricePerL && (
                <p className="text-xs text-destructive">{fieldErrors.pricePerL}</p>
              )}
            </div>
          </div>

          {/* Computed Amount */}
          {computedAmount && (
            <div className="bg-muted/50 p-3 rounded-md text-sm">
              Amount: <span className="font-semibold">₹{computedAmount}</span>
            </div>
          )}

          {/* Station */}
          <div className={MODAL_LABEL_SPACE}>
            <Label htmlFor="station">Fuel Station</Label>
            <Input disabled={loading}
              data-testid="components-createDieselModal-createDieselModal-input-7"
              id="station"
              placeholder="Station Name / Location"
              value={formData.station}
              onChange={handleChange}
            />
          </div>

          {/* Payment & Receipt */}
          <div className={MODAL_GRID}>
            <div className={MODAL_LABEL_SPACE}>
              <Label>Payment Method</Label>
              <Select disabled={loading}
                data-testid="components-createDieselModal-createDieselModal-select-2"
                value={formData.paymentMethod}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    paymentMethod: v as PaymentMethod,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Fleet">Fleet Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={MODAL_LABEL_SPACE}>
              <Label htmlFor="receiptNumber">Receipt Number</Label>
              <Input disabled={loading}
                data-testid="components-createDieselModal-createDieselModal-input-8"
                id="receiptNumber"
                placeholder="Receipt / Bill No."
                value={formData.receiptNumber}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Notes */}
          <div className={MODAL_LABEL_SPACE}>
            <Label htmlFor="notes">Notes</Label>
            <Textarea disabled={loading}
              id="notes"
              placeholder="Any additional notes..."
              value={formData.notes}
              onChange={handleChange}
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        {submitError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 pb-2 border-t mt-4">
          <Button
            data-testid="components-createDieselModal-createDieselModal-button-3"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            data-testid="components-createDieselModal-createDieselModal-button-4"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
            )}
            {loading ? "Saving..." : "Save Record"}
          </Button>
        </div>
        </div>
      </ModalBody>

      {/* ── Stacked Add Driver Modal ── */}
      <AddDriverModal
        isOpen={showAddDriver}
        onClose={() => setShowAddDriver(false)}
        onSuccess={handleDriverAdded}
        mode="nested"
      />
    </>
  );
};

/**
 * Wrapper — conditionally mounts/unmounts form so state resets on each open.
 */
const CreateDieselModal: React.FC<CreateDieselModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vehicles,
  defaultVehicleId,
}) => {
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent className="w-[95vw] sm:max-w-2xl rounded-xl sm:rounded-2xl scrollbar-custom">
        <CreateDieselForm
          onClose={onClose}
          onSuccess={onSuccess}
          vehicles={vehicles}
          defaultVehicleId={defaultVehicleId}
        />
      </ModalContent>
    </Modal>
  );
};

export default CreateDieselModal;
