"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SaveIcon, UserPlusIcon, ArrowUpDownIcon } from "@/components/ui/icon";
import type { TripBookingsModalProps } from "./tripBookingsModal.types";
import {
  getDefaultTripBookingFormData,
  NOTES_MAX_LENGTH,
} from "../tripBookingsPage/tripBookingsPage.types";
import type {
  TripBookingFormData,
  TripBookingWithDetails,
} from "../tripBookingsPage/tripBookingsPage.types";
import { VEHICLE_TYPES, SEATING_CAPACITY_TYPES } from "@/app/admin/vehicles/vehicles.types";
import type { Vehicle, VehicleType } from "@/app/admin/vehicles/vehicles.types";
import type { Driver } from "@/components/driversPage/driversPage.types";
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
import { LoadingSpinner } from "@/components/loadingSpinner";
import { AddDriverModal } from "@/components/addDriverModal";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import * as styles from "./tripBookingsModal.style";

const PHONE_REGEX = /^[6-9]\d{9}$/;

// ─── Inner Form ───

const TripBookingsForm: React.FC<{
  mode: "create" | "edit";
  record?: TripBookingWithDetails;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  vehicles: Vehicle[];
}> = ({ mode, record, onClose, onSuccess, vehicles }) => {
  const isEdit = mode === "edit";

  const [driversList, setDriversList] = useState<Driver[]>([]);
  const [showAddDriver, setShowAddDriver] = useState(false);

  const [formData, setFormData] = useState<TripBookingFormData>(() => {
    if (isEdit && record) {
      return {
        customerName: record.customer_name || "",
        customerPhone: record.customer_phone || "",
        fromLocation: record.from_location || "",
        toLocation: record.to_location || "",
        startDate: record.start_date || "",
        endDate: record.end_date || "",
        vehicleType: record.vehicle_type,
        seatingCapacity: record.seating_capacity ? String(record.seating_capacity) : "",
        vehicleId: record.vehicle_id ? String(record.vehicle_id) : "",
        driverId: record.driver_id ? String(record.driver_id) : "",
        quotedAmount: record.quoted_amount != null ? String(record.quoted_amount) : "",
        advanceAmount: String(record.advance_amount ?? "0"),
        notes: record.notes || "",
      };
    }
    return getDefaultTripBookingFormData();
  });

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const swapLocations = () => {
    setFormData((prev) => ({
      ...prev,
      fromLocation: prev.toLocation,
      toLocation: prev.fromLocation,
    }));
    setFieldErrors((prev) => ({ ...prev, fromLocation: "", toLocation: "" }));
  };

  const fetchDrivers = () => {
    fetch("/api/drivers?include_inactive=true")
      .then((res) => res.json())
      .then((json) => {
        const arr = json.data?.data ?? json.data;
        if (Array.isArray(arr)) setDriversList(arr);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const handleDriverAdded = (newDriver: Driver) => {
    setDriversList((prev) => [...prev, newDriver]);
    setFormData((prev) => ({ ...prev, driverId: String(newDriver.id) }));
    setShowAddDriver(false);
  };

  const showsSeating = formData.vehicleType
    ? SEATING_CAPACITY_TYPES.includes(formData.vehicleType)
    : false;

  const today = new Date().toISOString().slice(0, 10);
  const isPastStartDate = formData.startDate && formData.startDate < today;

  const vehiclesOfType = formData.vehicleType
    ? vehicles.filter((v) => v.vehicle_type === formData.vehicleType)
    : vehicles;

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!formData.customerName.trim()) {
      errors.customerName = "Customer name is required";
    }
    if (!formData.fromLocation.trim()) {
      errors.fromLocation = "From location is required";
    }
    if (!formData.toLocation.trim()) {
      errors.toLocation = "To location is required";
    }
    if (!formData.startDate) {
      errors.startDate = "Start date is required";
    }
    if (!formData.vehicleType) {
      errors.vehicleType = "Vehicle type is required";
    }

    if (
      formData.customerPhone.trim() &&
      !PHONE_REGEX.test(formData.customerPhone.trim())
    ) {
      errors.customerPhone = "Invalid phone (10 digits)";
    }

    if (formData.startDate && formData.endDate) {
      if (new Date(formData.endDate) < new Date(formData.startDate)) {
        errors.endDate = "End date cannot be before start date";
      }
    }

    if (showsSeating && formData.seatingCapacity.trim()) {
      const val = Number(formData.seatingCapacity);
      if (!Number.isFinite(val) || val <= 0) {
        errors.seatingCapacity = "Seating capacity must be a positive number";
      }
    }

    if (formData.quotedAmount.trim()) {
      const val = Number(formData.quotedAmount);
      if (!Number.isFinite(val) || val < 0) {
        errors.quotedAmount = "Quoted amount must be a non-negative number";
      }
    }

    if (formData.advanceAmount.trim()) {
      const val = Number(formData.advanceAmount);
      if (!Number.isFinite(val) || val < 0) {
        errors.advanceAmount = "Advance amount must be a non-negative number";
      }
    }

    if (formData.notes.length > NOTES_MAX_LENGTH) {
      errors.notes = `Notes must be ${NOTES_MAX_LENGTH} characters or fewer`;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      let response: Response;

      if (isEdit && record) {
        response = await fetch("/api/trip-bookings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: record.id,
            customer_name: formData.customerName.trim(),
            customer_phone: formData.customerPhone.trim() || undefined,
            from_location: formData.fromLocation.trim(),
            to_location: formData.toLocation.trim(),
            start_date: formData.startDate,
            end_date: formData.endDate || null,
            vehicle_type: formData.vehicleType,
            seating_capacity:
              showsSeating && formData.seatingCapacity
                ? Number(formData.seatingCapacity)
                : null,
            vehicle_id: formData.vehicleId ? Number(formData.vehicleId) : null,
            driver_id: formData.driverId ? Number(formData.driverId) : null,
            quoted_amount:
              formData.quotedAmount.trim() !== "" ? Number(formData.quotedAmount) : null,
            advance_amount: Number(formData.advanceAmount || 0),
            notes: formData.notes.trim() || undefined,
          }),
        });
      } else {
        response = await fetch("/api/trip-bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: formData.customerName.trim(),
            customer_phone: formData.customerPhone.trim() || undefined,
            from_location: formData.fromLocation.trim(),
            to_location: formData.toLocation.trim(),
            start_date: formData.startDate,
            end_date: formData.endDate || undefined,
            vehicle_type: formData.vehicleType,
            seating_capacity:
              showsSeating && formData.seatingCapacity
                ? Number(formData.seatingCapacity)
                : undefined,
            vehicle_id: formData.vehicleId ? Number(formData.vehicleId) : undefined,
            driver_id: formData.driverId ? Number(formData.driverId) : undefined,
            quoted_amount:
              formData.quotedAmount.trim() !== "" ? Number(formData.quotedAmount) : undefined,
            advance_amount: formData.advanceAmount.trim()
              ? Number(formData.advanceAmount)
              : undefined,
            notes: formData.notes.trim() || undefined,
          }),
        });
      }

      const data = await response.json();

      if (response.ok) {
        await onSuccess();
        setLoading(false);
        onClose();
      } else {
        setSubmitError(data.error || "Failed to save booking");
        setLoading(false);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
      setLoading(false);
    }
  };

  const getErrorStyle = (errorKey: string, extra?: React.CSSProperties) => {
    const hasError = !!fieldErrors[errorKey];
    return {
      ...(extra || {}),
      border: hasError ? "1px solid var(--destructive)" : "1px solid var(--border)",
    };
  };

  return (
    <>
      <ModalHeader>
        <ModalTitle>{isEdit ? "Edit Trip Booking" : "New Trip Booking"}</ModalTitle>
        <ModalDescription>
          {isEdit
            ? "Update booking details."
            : "Record a confirmed advance booking for a future trip."}
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div style={styles.formSection}>
          {/* ── Customer ── */}
          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <Label style={styles.fieldLabel}>
                Customer Name
                <span style={styles.requiredStar}>*</span>
              </Label>
              <Input
                disabled={loading}
                placeholder="Person or company name"
                value={formData.customerName}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, customerName: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, customerName: "" }));
                }}
                style={getErrorStyle("customerName")}
              />
              {fieldErrors.customerName && (
                <span style={styles.fieldError}>{fieldErrors.customerName}</span>
              )}
            </div>
            <div style={styles.fieldGroup}>
              <Label>Customer Phone</Label>
              <Input
                disabled={loading}
                placeholder="10-digit mobile"
                value={formData.customerPhone}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, customerPhone: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, customerPhone: "" }));
                }}
                style={getErrorStyle("customerPhone")}
              />
              {fieldErrors.customerPhone && (
                <span style={styles.fieldError}>{fieldErrors.customerPhone}</span>
              )}
            </div>
          </div>

          {/* ── Route ── */}
          <div style={styles.routeSection}>
            <div style={styles.fieldGroup}>
              <Label style={styles.fieldLabel}>
                From Location
                <span style={styles.requiredStar}>*</span>
              </Label>
              <Input
                disabled={loading}
                placeholder="Origin"
                value={formData.fromLocation}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, fromLocation: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, fromLocation: "" }));
                }}
                style={getErrorStyle("fromLocation")}
              />
              {fieldErrors.fromLocation && (
                <span style={styles.fieldError}>{fieldErrors.fromLocation}</span>
              )}
            </div>
            <div style={styles.routeSwapRow}>
              <button
                type="button"
                onClick={swapLocations}
                disabled={loading}
                style={styles.routeSwapButton}
                className="max-md:!h-9 max-md:!w-9"
                title="Swap From/To"
                aria-label="Swap From and To locations"
              >
                <ArrowUpDownIcon size={14} />
              </button>
            </div>
            <div style={styles.fieldGroup}>
              <Label style={styles.fieldLabel}>
                To Location
                <span style={styles.requiredStar}>*</span>
              </Label>
              <Input
                disabled={loading}
                placeholder="Destination"
                value={formData.toLocation}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, toLocation: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, toLocation: "" }));
                }}
                style={getErrorStyle("toLocation")}
              />
              {fieldErrors.toLocation && (
                <span style={styles.fieldError}>{fieldErrors.toLocation}</span>
              )}
            </div>
          </div>

          {/* ── Dates ── */}
          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <Label style={styles.fieldLabel}>
                Start Date
                <span style={styles.requiredStar}>*</span>
              </Label>
              <Input
                disabled={loading}
                type="date"
                value={formData.startDate}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, startDate: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, startDate: "" }));
                }}
                style={getErrorStyle("startDate")}
              />
              {fieldErrors.startDate && (
                <span style={styles.fieldError}>{fieldErrors.startDate}</span>
              )}
              {!fieldErrors.startDate && isPastStartDate && (
                <span style={styles.fieldError}>
                  This date is in the past — double check before saving.
                </span>
              )}
            </div>
            <div style={styles.fieldGroup}>
              <Label>End Date</Label>
              <Input
                disabled={loading}
                type="date"
                value={formData.endDate}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, endDate: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, endDate: "" }));
                }}
                style={getErrorStyle("endDate")}
              />
              {fieldErrors.endDate && (
                <span style={styles.fieldError}>{fieldErrors.endDate}</span>
              )}
            </div>
          </div>

          {/* ── Vehicle Requirement ── */}
          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <Label style={styles.fieldLabel}>
                Vehicle Type
                <span style={styles.requiredStar}>*</span>
              </Label>
              <Select
                value={formData.vehicleType ?? ""}
                onValueChange={(v) => {
                  const nextType = v as VehicleType;
                  setFormData((prev) => ({
                    ...prev,
                    vehicleType: nextType,
                    seatingCapacity: SEATING_CAPACITY_TYPES.includes(nextType)
                      ? prev.seatingCapacity
                      : "",
                    vehicleId: "",
                  }));
                  setFieldErrors((prev) => ({ ...prev, vehicleType: "" }));
                }}
                disabled={loading}
              >
                <SelectTrigger className="bg-background" style={getErrorStyle("vehicleType")}>
                  <SelectValue placeholder="Select vehicle type" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.vehicleType && (
                <span style={styles.fieldError}>{fieldErrors.vehicleType}</span>
              )}
            </div>
            {showsSeating && (
              <div style={styles.fieldGroup}>
                <Label>Seating Capacity</Label>
                <Input
                  disabled={loading}
                  type="number"
                  min="1"
                  placeholder="No. of seats"
                  value={formData.seatingCapacity}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, seatingCapacity: e.target.value }));
                    setFieldErrors((prev) => ({ ...prev, seatingCapacity: "" }));
                  }}
                  style={getErrorStyle("seatingCapacity")}
                />
                {fieldErrors.seatingCapacity && (
                  <span style={styles.fieldError}>{fieldErrors.seatingCapacity}</span>
                )}
              </div>
            )}
          </div>

          {/* ── Assign vehicle (optional) ── */}
          <div style={styles.fieldGroup}>
            <Label style={styles.fieldLabel}>Assigned Vehicle (optional)</Label>
            <Typeahead
              disabled={loading}
              options={vehiclesOfType}
              value={formData.vehicleId}
              onValueChange={(val) => setFormData((prev) => ({ ...prev, vehicleId: val }))}
              getOptionValue={(v) => v.id.toString()}
              getOptionLabel={(v) => `${v.vehicle_number} — ${v.company} ${v.model}`.trim()}
              getOptionKeywords={(v) => [v.vehicle_number, v.company, v.model]}
              placeholder="Not decided yet — search to assign"
              emptyMessage="No matching vehicles found."
            />
          </div>

          {/* ── Driver (optional) ── */}
          <div style={styles.fieldGroup}>
            <Label style={styles.fieldLabel}>Driver (optional)</Label>
            <Typeahead
              disabled={loading}
              options={driversList}
              value={formData.driverId}
              onValueChange={(driverId) => {
                const driver = driversList.find((d) => d.id.toString() === driverId);
                if (driver && !driver.is_active) return;
                setFormData((prev) => ({ ...prev, driverId }));
              }}
              getOptionValue={(d) => d.id.toString()}
              getOptionLabel={(d) => (d.is_active ? d.name : `${d.name} (Inactive)`)}
              getOptionDescription={(d) =>
                [d.phone, d.place].filter(Boolean).join(" · ") || undefined
              }
              getOptionKeywords={(d) => [d.name, d.phone || "", d.place || ""]}
              placeholder="Search drivers..."
              emptyMessage="No drivers found."
              footer={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground mt-1"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setShowAddDriver(true)}
                >
                  <UserPlusIcon size={14} className="mr-2" />
                  Add New Driver
                </Button>
              }
            />
          </div>

          {/* ── Amounts ── */}
          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <Label>Quoted Amount (₹)</Label>
              <Input
                disabled={loading}
                type="number"
                min="0"
                placeholder="Amount agreed with customer"
                value={formData.quotedAmount}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, quotedAmount: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, quotedAmount: "" }));
                }}
                style={getErrorStyle("quotedAmount")}
              />
              {fieldErrors.quotedAmount && (
                <span style={styles.fieldError}>{fieldErrors.quotedAmount}</span>
              )}
            </div>
            <div style={styles.fieldGroup}>
              <Label>Advance Received (₹)</Label>
              <Input
                disabled={loading}
                type="number"
                min="0"
                placeholder="0"
                value={formData.advanceAmount}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, advanceAmount: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, advanceAmount: "" }));
                }}
                style={getErrorStyle("advanceAmount")}
              />
              {fieldErrors.advanceAmount && (
                <span style={styles.fieldError}>{fieldErrors.advanceAmount}</span>
              )}
            </div>
          </div>

          {/* ── Notes ── */}
          <div style={styles.fieldGroup}>
            <Label>Notes</Label>
            <Textarea
              disabled={loading}
              placeholder="Any additional details..."
              value={formData.notes}
              onChange={(e) => {
                if (e.target.value.length <= NOTES_MAX_LENGTH) {
                  setFormData((prev) => ({ ...prev, notes: e.target.value }));
                }
                setFieldErrors((prev) => ({ ...prev, notes: "" }));
              }}
              rows={2}
              style={getErrorStyle("notes")}
            />
            <div style={styles.charCounter}>
              {fieldErrors.notes && <span style={styles.fieldError}>{fieldErrors.notes}</span>}
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "0.75rem",
                  color:
                    formData.notes.length > NOTES_MAX_LENGTH * 0.9
                      ? "var(--destructive)"
                      : "var(--muted-foreground)",
                }}
              >
                {formData.notes.length}/{NOTES_MAX_LENGTH}
              </span>
            </div>
          </div>
        </div>

        {submitError && (
          <div style={{ ...styles.errorBanner, marginTop: "1rem" }}>{submitError}</div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
          )}
          {isEdit ? "Update Booking" : "Save Booking"}
        </Button>
      </ModalFooter>

      <AddDriverModal
        isOpen={showAddDriver}
        onClose={() => setShowAddDriver(false)}
        onSuccess={handleDriverAdded}
        mode="nested"
      />
    </>
  );
};

export const TripBookingsModal: React.FC<TripBookingsModalProps> = (props) => {
  return (
    <Modal open={props.isOpen} onOpenChange={(open) => !open && props.onClose()}>
      <ModalContent style={{ maxWidth: "48rem", padding: 0 }}>
        {props.isOpen && (
          <TripBookingsForm
            mode={props.mode}
            record={props.record}
            onClose={props.onClose}
            onSuccess={props.onSuccess}
            vehicles={props.vehicles}
          />
        )}
      </ModalContent>
    </Modal>
  );
};
