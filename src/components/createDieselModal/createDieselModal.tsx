"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CreateDieselModalProps } from "./createDieselModal.types";
import { Save, AlertTriangle } from "lucide-react";
import { LoadingSpinner } from "@/components/loadingSpinner";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
}> = ({ onClose, onSuccess, vehicles }) => {
  const [formData, setFormData] = useState(getDefaultFormData());
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

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
  };

  const handleSubmit = async () => {
    if (
      !formData.vehicleId ||
      !formData.driverName ||
      !formData.fuelLitres ||
      !formData.currentOdo
    ) {
      setSubmitError("Please fill all mandatory fields");
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
        price_per_l: parseFloat(formData.pricePerL),
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
    <div className="w-full">
      <div className="space-y-6 sm:mt-2">
        {/* Header */}
        <div className="mb-2 pr-8">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            New Diesel Entry
          </h2>
          <p className="text-sm text-muted-foreground hidden sm:block mt-1">
            Record fuel consumption for a vehicle.
          </p>
        </div>

        {/* Error */}
        {submitError && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm border border-red-100 dark:border-red-800">
            {submitError}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-4 py-3 rounded-md space-y-1">
            {warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
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
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                data-testid="components-createDieselModal-createDieselModal-input-1"
                id="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
              />
            </div>
            <div className={MODAL_LABEL_SPACE}>
              <Label htmlFor="time">
                Time <span className="text-red-500">*</span>
              </Label>
              <Input
                data-testid="components-createDieselModal-createDieselModal-input-2"
                id="time"
                type="time"
                value={formData.time}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Vehicle */}
          <div className={MODAL_LABEL_SPACE}>
            <Label>
              Vehicle <span className="text-red-500">*</span>
            </Label>
            <Select
              data-testid="components-createDieselModal-createDieselModal-select-1"
              value={formData.vehicleId}
              onValueChange={(v) => {
                setFormData((prev) => ({ ...prev, vehicleId: v }));
                setSubmitError(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id.toString()}>
                    {v.vehicle_number} — {v.company} {v.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              Driver Name <span className="text-red-500">*</span>
            </Label>
            <Input
              data-testid="components-createDieselModal-createDieselModal-input-3"
              id="driverName"
              placeholder="Driver Name"
              value={formData.driverName}
              onChange={handleChange}
            />
          </div>

          {/* Fill Type & Odometer */}
          <div className={MODAL_GRID}>
            <div className={MODAL_LABEL_SPACE}>
              <Label>
                Fill Type <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Button
                  data-testid="components-createDieselModal-createDieselModal-button-1"
                  type="button"
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
                Current Odometer (km) <span className="text-red-500">*</span>
              </Label>
              <Input
                data-testid="components-createDieselModal-createDieselModal-input-4"
                id="currentOdo"
                type="number"
                placeholder="0"
                min="0"
                value={formData.currentOdo}
                onChange={handleChange}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
          </div>

          {/* Fuel & Price */}
          <div className={MODAL_GRID}>
            <div className={MODAL_LABEL_SPACE}>
              <Label htmlFor="fuelLitres">
                Fuel Added (Litres) <span className="text-red-500">*</span>
              </Label>
              <Input
                data-testid="components-createDieselModal-createDieselModal-input-5"
                id="fuelLitres"
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={formData.fuelLitres}
                onChange={handleChange}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
            <div className={MODAL_LABEL_SPACE}>
              <Label htmlFor="pricePerL">Price per L (₹)</Label>
              <Input
                data-testid="components-createDieselModal-createDieselModal-input-6"
                id="pricePerL"
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={formData.pricePerL}
                onChange={handleChange}
                onWheel={(e) => e.currentTarget.blur()}
              />
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
            <Input
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
              <Select
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
              <Input
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
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              value={formData.notes}
              onChange={handleChange}
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
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
              <Save className="mr-2 h-4 w-4" />
            )}
            {loading ? "Saving..." : "Save Record"}
          </Button>
        </div>
      </div>
    </div>
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
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl p-0 overflow-hidden rounded-xl sm:rounded-2xl">
        <div className="max-h-[85vh] overflow-y-auto p-4 sm:p-6 scrollbar-custom">
          <CreateDieselForm
            onClose={onClose}
            onSuccess={onSuccess}
            vehicles={vehicles}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDieselModal;
