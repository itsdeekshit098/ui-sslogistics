"use client";

import React, { useState, useEffect, useCallback } from "react";
import { EditDieselModalProps } from "./editDieselModal.types";
import { SaveIcon, UserPlusIcon } from "@/components/ui/icon";
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
import { Modal, ModalContent } from "@/components/ui/modal";
import { AddDriverModal } from "@/components/addDriverModal";
import type { Driver } from "@/components/driversPage/driversPage.types";
import type { PaymentMethod } from "@/app/admin/diesel-records/dieselRecords.types";

const MODAL_GRID = "grid grid-cols-1 sm:grid-cols-2 gap-4";
const MODAL_LABEL_SPACE = "space-y-2";

const EditDieselForm: React.FC<{
  record: NonNullable<EditDieselModalProps["record"]>;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}> = ({ record, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    driverName: record.driver_name,
    fuelLitres: record.fuel_litres.toString(),
    pricePerL: record.price_per_l ? record.price_per_l.toString() : "",
    station: record.station || "",
    paymentMethod: (record.payment_method || "") as PaymentMethod | "",
    receiptNumber: record.receipt_number || "",
    notes: record.notes || "",
  });
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
    if (!formData.driverName.trim())
      errors.driverName = "Driver name is required";
    if (!formData.fuelLitres) errors.fuelLitres = "Fuel is required";
    else if (parseFloat(formData.fuelLitres) <= 0)
      errors.fuelLitres = "Must be > 0";
    if (formData.pricePerL && parseFloat(formData.pricePerL) < 0)
      errors.pricePerL = "Must be ≥ 0";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitError("Please fix the validation errors below.");
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const payload = {
        id: record.id,
        driver_name: formData.driverName.trim(),
        fuel_litres: parseFloat(formData.fuelLitres),
        price_per_l: formData.pricePerL ? parseFloat(formData.pricePerL) : 0,
        station: formData.station.trim() || null,
        payment_method: formData.paymentMethod || null,
        receipt_number: formData.receiptNumber.trim() || null,
        notes: formData.notes.trim() || null,
      };

      const response = await fetch("/api/diesel-records", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        await onSuccess();
        setLoading(false);
        onClose();
      } else {
        setSubmitError(data.error || "Failed to update record");
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="w-full">
      <div className="space-y-6 sm:mt-2">
        {/* Header */}
        <div className="mb-2 pr-8">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Edit Diesel Entry
          </h2>
          <p className="text-sm text-muted-foreground hidden sm:block mt-1">
            Update editable fields for this record.
          </p>
        </div>

        {/* Read-only info */}
        <div className="bg-muted/50 p-3 rounded-md text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Vehicle:</span>{" "}
            {record.vehicles?.vehicle_number || `#${record.vehicle_id}`}
          </p>
          <p>
            <span className="text-muted-foreground">Date:</span>{" "}
            {formatDate(record.fill_date)}
            {" · "}
            <span className="text-muted-foreground">Fill:</span>{" "}
            {record.fill_type === "full" ? "Full" : "Partial"}
            {" · "}
            <span className="text-muted-foreground">Odo:</span>{" "}
            {record.current_odo} km
          </p>
        </div>

        {/* Error */}
        {submitError && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm border border-red-100 dark:border-red-800">
            {submitError}
          </div>
        )}

        {/* Editable Fields */}
        <div className="space-y-4">
          {/* Driver */}
          <div className={MODAL_LABEL_SPACE}>
            <Label htmlFor="driverName">
              Driver Name <span className="text-red-500">*</span>
            </Label>
            <Typeahead
              id="driverName"
              data-testid="components-editDieselModal-editDieselModal-driver-typeahead"
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
                [d.phone, d.place].filter(Boolean).join(" \u00b7 ") || undefined
              }
              getOptionKeywords={(d) => [d.name, d.phone || "", d.place || ""]}
              placeholder="Search drivers..."
              emptyMessage="No drivers found."
              invalid={Boolean(fieldErrors.driverName)}
              footer={
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-muted transition-colors"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={() => setShowAddDriver(true)}
                >
                  <UserPlusIcon size={14} />
                  Add New Driver
                </button>
              }
            />
            {fieldErrors.driverName && (
              <p className="text-xs text-red-500">{fieldErrors.driverName}</p>
            )}
          </div>

          {/* Fuel & Price */}
          <div className={MODAL_GRID}>
            <div className={MODAL_LABEL_SPACE}>
              <Label htmlFor="fuelLitres">
                Fuel Added (Litres) <span className="text-red-500">*</span>
              </Label>
              <Input
                data-testid="components-editDieselModal-editDieselModal-input-2"
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
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }
              />
              {fieldErrors.fuelLitres && (
                <p className="text-xs text-red-500">{fieldErrors.fuelLitres}</p>
              )}
            </div>
            <div className={MODAL_LABEL_SPACE}>
              <Label htmlFor="pricePerL">Price per L (₹)</Label>
              <Input
                data-testid="components-editDieselModal-editDieselModal-input-3"
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
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }
              />
              {fieldErrors.pricePerL && (
                <p className="text-xs text-red-500">{fieldErrors.pricePerL}</p>
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
            <Input
              data-testid="components-editDieselModal-editDieselModal-input-4"
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
                data-testid="components-editDieselModal-editDieselModal-select-1"
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
                data-testid="components-editDieselModal-editDieselModal-input-5"
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
            data-testid="components-editDieselModal-editDieselModal-button-1"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            data-testid="components-editDieselModal-editDieselModal-button-2"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
            )}
            {loading ? "Updating..." : "Update Record"}
          </Button>
        </div>
      </div>

      {/* ── Stacked Add Driver Modal ── */}
      <AddDriverModal
        isOpen={showAddDriver}
        onClose={() => setShowAddDriver(false)}
        onSuccess={handleDriverAdded}
        mode="nested"
      />
    </div>
  );
};

const EditDieselModal: React.FC<EditDieselModalProps> = ({
  record,
  onClose,
  onSuccess,
}) => {
  return (
    <Modal open={!!record} onOpenChange={(open) => !open && onClose()}>
      <ModalContent className="w-[95vw] sm:max-w-2xl p-0 overflow-hidden rounded-xl sm:rounded-2xl">
        <div className="max-h-[85vh] overflow-y-auto p-4 sm:p-6 scrollbar-custom">
          {record && (
            <EditDieselForm
              record={record}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          )}
        </div>
      </ModalContent>
    </Modal>
  );
};

export default EditDieselModal;
