"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  XIcon,
  SaveIcon,
  PlusIcon,
  UserPlusIcon,
  Building2Icon,
  UserIcon,
  ArrowUpDownIcon,
} from "@/components/ui/icon";
import type { ExternalTripsModalProps, ExternalTripPrefill } from "./externalTripsModal.types";
import {
  getDefaultExternalTripFormData,
  PRESET_COST_LABELS,
  TRIP_TYPE_LABELS,
  NOTES_MAX_LENGTH,
} from "../externalTripsPage/externalTripsPage.types";
import type {
  TripType,
  ExternalTripFormData,
  ExternalTripWithDetails,
} from "../externalTripsPage/externalTripsPage.types";
import type { Driver } from "@/components/driversPage/driversPage.types";
import type { Vehicle } from "@/app/admin/vehicles/vehicles.types";
import { Typeahead } from "@/components/typeahead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import * as styles from "./externalTripsModal.style";

const PHONE_REGEX = /^[6-9]\d{9}$/;

// ─── Inner Form ───

const ExternalTripsForm: React.FC<{
  mode: "create" | "edit";
  record?: ExternalTripWithDetails;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  vehicles: Vehicle[];
  bookingId?: number;
  prefill?: ExternalTripPrefill;
  unifiedTrip?: boolean;
}> = ({ mode, record, onClose, onSuccess, vehicles, bookingId, prefill, unifiedTrip }) => {
  const isEdit = mode === "edit";

  // ─── Drivers state ───
  const [driversList, setDriversList] = useState<Driver[]>([]);
  const [showAddDriver, setShowAddDriver] = useState(false);

  // ─── Form state ───
  const [formData, setFormData] = useState<ExternalTripFormData>(() => {
    if (isEdit && record) {
      return {
        vehicleId: String(record.vehicle_id),
        tripType: record.trip_type,
        customerName: record.customer_name || "",
        customerPhone: record.customer_phone || "",
        fromLocation: record.from_location || "",
        toLocation: record.to_location || "",
        startDate: record.start_date || "",
        endDate: record.end_date || "",
        driverId: record.driver_id ? String(record.driver_id) : "",
        notes: record.notes || "",
        costItems: (record.cost_items || []).map((item) => ({
          label: item.label,
          amount: String(item.amount),
          isPreset: PRESET_COST_LABELS.includes(
            item.label as (typeof PRESET_COST_LABELS)[number],
          ),
        })),
        amountReceived: String(record.amount_received ?? ""),
      };
    }
    if (prefill) {
      const base = getDefaultExternalTripFormData();
      return {
        ...base,
        vehicleId: prefill.vehicleId ? String(prefill.vehicleId) : "",
        customerName: prefill.customerName || "",
        customerPhone: prefill.customerPhone || "",
        fromLocation: prefill.fromLocation || "",
        toLocation: prefill.toLocation || "",
        startDate: prefill.startDate || "",
        endDate: prefill.endDate || "",
        driverId: prefill.driverId ? String(prefill.driverId) : "",
        amountReceived:
          prefill.quotedAmount != null
            ? String(Math.max(prefill.quotedAmount - (prefill.advanceAmount ?? 0), 0))
            : base.amountReceived,
      };
    }
    return getDefaultExternalTripFormData();
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
  };

  // ─── Fetch drivers ───
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

  // ─── Close handler ───
  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  // ─── Driver add callback ───
  const handleDriverAdded = (newDriver: Driver) => {
    setDriversList((prev) => [...prev, newDriver]);
    setFormData((prev) => ({ ...prev, driverId: String(newDriver.id) }));
    setShowAddDriver(false);
  };

  // ─── Cost item handlers ───
  const addCostItem = () => {
    setFormData((prev) => ({
      ...prev,
      costItems: [
        ...prev.costItems,
        { label: "", amount: "", isPreset: false },
      ],
    }));
  };

  const removeCostItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      costItems: prev.costItems.filter((_, i) => i !== index),
    }));
  };

  const updateCostItem = (
    index: number,
    field: "label" | "amount",
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      costItems: prev.costItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
    // Clear cost errors
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`costItem_${index}`];
      return next;
    });
  };

  // ─── Running total ───
  const runningTotal = formData.costItems.reduce((sum, item) => {
    const val = Number(item.amount);
    return sum + (Number.isFinite(val) && val > 0 ? val : 0);
  }, 0);

  // ─── Submit ───
  const handleSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!formData.vehicleId) {
      errors.vehicleId = "Vehicle is required";
    }

    if (!formData.tripType) {
      errors.tripType = "Trip type is required";
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

    // Validate amount received (mandatory)
    const receivedVal = Number(formData.amountReceived);
    if (
      !formData.amountReceived.trim() ||
      !Number.isFinite(receivedVal) ||
      receivedVal < 0
    ) {
      errors.amountReceived = bookingId
        ? "Balance received is required (non-negative)"
        : "Amount received is required (non-negative)";
    }

    // Validate notes length
    if (formData.notes.length > NOTES_MAX_LENGTH) {
      errors.notes = `Notes must be ${NOTES_MAX_LENGTH} characters or fewer`;
    }

    // Validate cost items
    formData.costItems.forEach((item, index) => {
      if (item.isPreset) {
        // Preset items require an amount
        const val = Number(item.amount);
        if (!item.amount.trim() || !Number.isFinite(val) || val < 0) {
          errors[`costItem_${index}`] = `${item.label} amount is required`;
        }
      } else {
        // Custom items: if label or amount is filled, both must be filled
        if (item.label.trim() || item.amount.trim()) {
          if (!item.label.trim()) {
            errors[`costItem_${index}`] = "Label is required";
          }
          const val = Number(item.amount);
          if (!item.amount.trim() || !Number.isFinite(val) || val < 0) {
            errors[`costItem_${index}`] = "Valid amount is required";
          }
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const costItems = formData.costItems
        .filter((item) => item.label.trim() && item.amount.trim())
        .map((item) => ({
          label: item.label.trim(),
          amount: Number(item.amount),
        }));

      let response: Response;

      if (isEdit && record) {
        response = await fetch("/api/external-trips", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: record.id,
            customer_name: formData.customerName.trim() || undefined,
            customer_phone: formData.customerPhone.trim() || undefined,
            from_location: formData.fromLocation.trim() || undefined,
            to_location: formData.toLocation.trim() || undefined,
            start_date: formData.startDate || undefined,
            end_date: formData.endDate || null,
            driver_id: formData.driverId ? parseInt(formData.driverId) : null,
            notes: formData.notes.trim() || undefined,
            cost_items: costItems,
            amount_received: Number(formData.amountReceived),
          }),
        });
      } else {
        response = await fetch(
          bookingId || unifiedTrip
            ? "/api/trip-bookings/complete"
            : "/api/external-trips",
          {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicle_id: parseInt(formData.vehicleId),
            trip_type: formData.tripType,
            customer_name: formData.customerName.trim() || undefined,
            customer_phone: formData.customerPhone.trim() || undefined,
            from_location: formData.fromLocation.trim() || undefined,
            to_location: formData.toLocation.trim() || undefined,
            start_date: formData.startDate || undefined,
            end_date: formData.endDate || undefined,
            driver_id: formData.driverId
              ? parseInt(formData.driverId)
              : undefined,
            notes: formData.notes.trim() || undefined,
            cost_items: costItems,
            amount_received:
              Number(formData.amountReceived) + (prefill?.advanceAmount ?? 0),
            booking_id: bookingId,
          }),
          },
        );
      }

      const data = await response.json();

      if (response.ok) {
        await onSuccess();
        setLoading(false);
        onClose();
      } else {
        setSubmitError(data.error || "Failed to save trip");
        setLoading(false);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
      setLoading(false);
    }
  };

  // ─── Selected vehicle info ───
  const selectedVehicle = vehicles.find(
    (v) => v.id.toString() === formData.vehicleId,
  );
  const advanceReceived = bookingId ? prefill?.advanceAmount ?? 0 : 0;
  const totalReceived = Number(formData.amountReceived || 0) + advanceReceived;
  const totalCost = formData.costItems.reduce(
    (total, item) => total + (Number(item.amount) || 0),
    0,
  );
  const profit = totalReceived - totalCost;

  // Helper to apply error styling consistently and avoid React shorthand conflicts
  const getErrorStyle = (errorKey: string, extra?: React.CSSProperties) => {
    const hasError = !!fieldErrors[errorKey];
    return {
      ...(extra || {}),
      // Use shorthand to avoid mixing with class shorthand
      border: hasError ? "1px solid var(--destructive)" : "1px solid var(--border)",
    };
  };

  return (
    <>
      <ModalHeader>
        <ModalTitle>
          {isEdit ? "Edit Trip" : bookingId ? "Complete Trip Booking" : unifiedTrip ? "Record Completed Trip" : "New External Trip"}
        </ModalTitle>
        <ModalDescription>
          {isEdit
            ? "Update trip details."
            : bookingId
              ? "Enter the actual costs to record this trip and mark the booking completed."
              : unifiedTrip
                ? "Record a trip that was completed without an advance booking."
              : "Record a new external trip."}
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        {bookingId && (prefill?.quotedAmount != null || prefill?.advanceAmount) && (
          <div style={styles.readOnlyBadge}>
            {prefill?.quotedAmount != null && (
              <>Quoted: ₹{Number(prefill.quotedAmount).toLocaleString("en-IN")}</>
            )}
            {prefill?.quotedAmount != null && prefill?.advanceAmount ? " · " : ""}
            {!!prefill?.advanceAmount && (
              <>Advance received: ₹{Number(prefill.advanceAmount).toLocaleString("en-IN")}</>
            )}
          </div>
        )}
        <div style={styles.formSection}>
            {/* ── Vehicle ── */}
            <div style={styles.fieldGroup}>
              <Label style={styles.fieldLabel}>
                Vehicle
                <span style={styles.requiredStar}>*</span>
              </Label>
              {isEdit && selectedVehicle ? (
                <div style={styles.readOnlyBadge}>
                  {selectedVehicle.vehicle_number} — {selectedVehicle.company}{" "}
                  {selectedVehicle.model}
                </div>
              ) : (
                <Typeahead disabled={loading}
                  id="vehicleId"
                  options={vehicles}
                  value={formData.vehicleId}
                  onValueChange={(val) => {
                    setFormData((prev) => ({ ...prev, vehicleId: val }));
                    setFieldErrors((prev) => ({ ...prev, vehicleId: "" }));
                  }}
                  getOptionValue={(v) => v.id.toString()}
                  getOptionLabel={(v) =>
                    `${v.vehicle_number} — ${v.company} ${v.model}`.trim()
                  }
                  getOptionKeywords={(v) => [
                    v.vehicle_number,
                    v.company,
                    v.model,
                  ]}
                  placeholder="Search vehicles..."
                  emptyMessage="No vehicles found."
                  invalid={Boolean(fieldErrors.vehicleId)}
                />
              )}
              {fieldErrors.vehicleId && (
                <span style={styles.fieldError}>{fieldErrors.vehicleId}</span>
              )}
            </div>

            {/* ── Trip Type ── */}
            <div style={styles.fieldGroup}>
              <Label style={styles.fieldLabel}>
                Trip Type
                <span style={styles.requiredStar}>*</span>
              </Label>
              {isEdit ? (
                <div style={styles.readOnlyBadge}>
                  {formData.tripType
                    ? TRIP_TYPE_LABELS[formData.tripType]
                    : "—"}
                </div>
              ) : (
                <div style={styles.categoryGrid}>
                  {(
                    Object.entries(TRIP_TYPE_LABELS) as [TripType, string][]
                  ).map(([key, label]) => {
                    const selected = formData.tripType === key;
                    const Icon = key === "company_oncall" ? Building2Icon : UserIcon;
                    return (
                      <div
                        key={key}
                        style={{
                          ...styles.categoryCardBase,
                          ...(selected ? styles.categoryCardSelected : {}),
                        }}
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            tripType: key,
                          }));
                          setFieldErrors((prev) => ({
                            ...prev,
                            tripType: "",
                          }));
                        }}
                      >
                        <div>
                          <Icon
                            size={20}
                            style={{
                              marginBottom: "0.25rem",
                              margin: "0 auto 0.25rem",
                            }}
                          />
                          <span style={styles.categoryLabel}>{label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {fieldErrors.tripType && (
                <span style={styles.fieldError}>{fieldErrors.tripType}</span>
              )}
            </div>

            {/* ── Customer ── */}
            <div style={styles.formGrid}>
              <div style={styles.fieldGroup}>
                <Label htmlFor="customerName">Customer Name</Label>
                <Input disabled={loading}
                  id="customerName"
                  placeholder="Company or person name"
                  value={formData.customerName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      customerName: e.target.value,
                    }))
                  }
                />
              </div>
              <div style={styles.fieldGroup}>
                <Label htmlFor="customerPhone">Customer Phone</Label>
                <Input disabled={loading}
                  id="customerPhone"
                  placeholder="10-digit mobile"
                  value={formData.customerPhone}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      customerPhone: e.target.value,
                    }));
                    setFieldErrors((prev) => ({
                      ...prev,
                      customerPhone: "",
                    }));
                  }}
                  style={getErrorStyle("customerPhone")}
                />
                {fieldErrors.customerPhone && (
                  <span style={styles.fieldError}>
                    {fieldErrors.customerPhone}
                  </span>
                )}
              </div>
            </div>

            {/* ── Route ── */}
            <div style={styles.routeSection}>
              <div style={styles.fieldGroup}>
                <Label htmlFor="fromLocation">From Location</Label>
                <Input
                  disabled={loading}
                  id="fromLocation"
                  placeholder="Origin"
                  value={formData.fromLocation}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      fromLocation: e.target.value,
                    }))
                  }
                />
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
                <Label htmlFor="toLocation">To Location</Label>
                <Input
                  disabled={loading}
                  id="toLocation"
                  placeholder="Destination"
                  value={formData.toLocation}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      toLocation: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* ── Dates ── */}
            <div style={styles.formGrid}>
              <div style={styles.fieldGroup}>
                <Label htmlFor="startDate">Start Date</Label>
                <Input disabled={loading}
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div style={styles.fieldGroup}>
                <Label htmlFor="endDate">End Date</Label>
                <Input disabled={loading}
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }));
                    setFieldErrors((prev) => ({ ...prev, endDate: "" }));
                  }}
                  style={getErrorStyle("endDate")}
                />
                {fieldErrors.endDate && (
                  <span style={styles.fieldError}>{fieldErrors.endDate}</span>
                )}
              </div>
            </div>

            {/* ── Driver ── */}
            <div style={styles.fieldGroup}>
              <Label style={styles.fieldLabel}>Driver</Label>
              <Typeahead disabled={loading}
                id="driverId"
                options={driversList}
                value={formData.driverId}
                onValueChange={(driverId) => {
                  const driver = driversList.find(
                    (d) => d.id.toString() === driverId,
                  );
                  if (driver && !driver.is_active) return; // Prevent selecting inactive
                  setFormData((prev) => ({ ...prev, driverId }));
                }}
                getOptionValue={(d) => d.id.toString()}
                getOptionLabel={(d) =>
                  d.is_active ? d.name : `${d.name} (Inactive)`
                }
                getOptionDescription={(d) =>
                  [d.phone, d.place].filter(Boolean).join(" · ") || undefined
                }
                getOptionKeywords={(d) => [
                  d.name,
                  d.phone || "",
                  d.place || "",
                ]}
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

            {/* ── Notes ── */}
            <div style={styles.fieldGroup}>
              <Label htmlFor="notes">Notes</Label>
              <Textarea disabled={loading}
                id="notes"
                placeholder="Any additional details..."
                value={formData.notes}
                onChange={(e) => {
                  if (e.target.value.length <= NOTES_MAX_LENGTH) {
                    setFormData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }));
                  }
                  setFieldErrors((prev) => ({ ...prev, notes: "" }));
                }}
                rows={2}
                style={getErrorStyle("notes")}
              />
              <div style={styles.charCounter}>
                {fieldErrors.notes && (
                  <span style={styles.fieldError}>{fieldErrors.notes}</span>
                )}
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

            {bookingId && (
              <div style={styles.fieldGroup}>
                <Label style={styles.fieldLabel}>Advance Received (₹)</Label>
                <div style={styles.readOnlyBadge}>
                  ₹{advanceReceived.toLocaleString("en-IN")}
                </div>
              </div>
            )}

            {/* ── Receipt ── */}
            <div style={styles.fieldGroup}>
              <Label style={styles.fieldLabel}>
                {bookingId ? "Balance Received Now (₹)" : "Amount Received (₹)"}
                <span style={styles.requiredStar}>*</span>
              </Label>
              <Input disabled={loading}
                id="amountReceived"
                placeholder={bookingId ? "Balance collected now" : "Amount received from customer"}
                type="number"
                min="0"
                value={formData.amountReceived}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    amountReceived: e.target.value,
                  }));
                  setFieldErrors((prev) => ({
                    ...prev,
                    amountReceived: "",
                  }));
                }}
                style={getErrorStyle("amountReceived")}
              />
              {fieldErrors.amountReceived && (
                <span style={styles.fieldError}>
                  {fieldErrors.amountReceived}
                </span>
              )}
            </div>

            {bookingId && (
              <div style={styles.receiptSummary}>
                <div>
                  <span>Total Received for Trip</span>
                  <strong>₹{totalReceived.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div>
                  <span>Profit</span>
                  <strong style={{ color: profit >= 0 ? "var(--success, #16a34a)" : "var(--destructive)" }}>
                    {profit >= 0 ? "+" : "-"}₹{Math.abs(profit).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            )}

            {/* ── Cost Items ── */}
            <div style={styles.costSection}>
              <div style={styles.costSectionTitle}>Cost Breakdown</div>

              {formData.costItems.map((item, index) => (
                <div key={index} style={styles.costRow}>
                  {item.isPreset ? (
                    <div style={styles.costPresetLabel}>
                      {item.label}
                      <span style={styles.requiredStar}>*</span>
                    </div>
                  ) : (
                    <Input disabled={loading}
                      placeholder="Label (e.g. Toll)"
                      value={item.label}
                      onChange={(e) =>
                        updateCostItem(index, "label", e.target.value)
                      }
                      style={getErrorStyle(`costItem_${index}`)}
                    />
                  )}
                  <Input disabled={loading}
                    placeholder="₹ Amount"
                    type="number"
                    min="0"
                    value={item.amount}
                    onChange={(e) =>
                      updateCostItem(index, "amount", e.target.value)
                    }
                    style={getErrorStyle(`costItem_${index}`)}
                  />
                  {item.isPreset ? (
                    <div style={{ width: "2rem" }} />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive w-8 h-8 shrink-0"
                      onClick={() => removeCostItem(index)}
                    >
                      <XIcon size={16} />
                    </Button>
                  )}
                  {fieldErrors[`costItem_${index}`] && (
                    <div
                      style={{
                        ...styles.fieldError,
                        gridColumn: "1 / -1",
                        marginTop: "-0.25rem",
                      }}
                    >
                      {fieldErrors[`costItem_${index}`]}
                    </div>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                className="w-full justify-center border-dashed text-muted-foreground hover:text-foreground hover:border-primary mt-2"
                onClick={addCostItem}
              >
                <PlusIcon size={14} className="mr-2" />
                Add Cost Item
              </Button>

              <div style={styles.costTotalRow}>
                <span>Total</span>
                <span>₹{runningTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>
        </div>

        {/* ── Error Banner ── */}
        {submitError && (
          <div style={{ ...styles.errorBanner, marginTop: "1rem" }}>
            {submitError}
          </div>
        )}
      </ModalBody>

      {/* ── Footer ── */}
      <ModalFooter>
        <Button variant="outline" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <SaveIcon
              size={16}
              style={{ marginRight: "0.5rem" }}
            />
          )}
          {isEdit ? "Update Trip" : unifiedTrip ? "Record Completed Trip" : "Save Trip"}
        </Button>
      </ModalFooter>

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

export const ExternalTripsModal: React.FC<ExternalTripsModalProps> = (
  props,
) => {
  return (
    <Modal open={props.isOpen} onOpenChange={(open) => !open && props.onClose()}>
      <ModalContent style={{ maxWidth: "48rem", padding: 0 }}>
        {props.isOpen && (
          <ExternalTripsForm
            mode={props.mode}
            record={props.record}
            onClose={props.onClose}
            onSuccess={props.onSuccess}
            vehicles={props.vehicles}
            bookingId={props.bookingId}
            prefill={props.prefill}
            unifiedTrip={props.unifiedTrip}
          />
        )}
      </ModalContent>
    </Modal>
  );
};
