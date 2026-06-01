"use client";

import React, { useState, useCallback } from "react";
import { SaveIcon, PlusIcon } from "@/components/ui/icon";
import type {
  PartModalProps,
  VehicleOption,
  PartFormState,
  Vendor,
} from "./partModal.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { Typeahead } from "@/components/typeahead";
import { AddVendorModal } from "@/components/addVendorModal";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import { computeExpiryDateFromStrings as computeExpiryDate } from "@/utils/warrantyExpiry";
import type { WarrantyItem } from "@/components/warrantyPage/warrantyPage.types";
import * as styles from "./partModal.style";


const PartForm: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
  mode: "add" | "edit";
  initialData?: WarrantyItem;
  vehicles: VehicleOption[];
  vendors: Vendor[];
  partOptions: { id: number; name: string }[];
  onVendorAdded: (vendor: Vendor) => void;
  onPartAdded: (part: { id: number; name: string }) => void;
}> = ({
  mode,
  initialData,
  onClose,
  onSuccess,
  vehicles,
  vendors,
  partOptions,
  onVendorAdded,
  onPartAdded,
}) => {
  const [formData, setFormData] = useState<PartFormState>(() => {
    if (mode === "edit" && initialData) {
      return {
        id: initialData.id,
        vehicleId: initialData.vehicle_id.toString(),
        partName: initialData.part_name,
        vendorId: initialData.vendor_id?.toString() || "",
        cost: initialData.cost.toString(),
        purchaseDate: initialData.purchase_date.split("T")[0],
        warrantyDuration: initialData.warranty_duration.toString(),
        warrantyDurationUnit: initialData.warranty_duration_unit,
        warrantyExpiry: initialData.warranty_expiry ? initialData.warranty_expiry.split("T")[0] : "",
        notes: initialData.notes || "",
      };
    }
    return {
      vehicleId: "",
      partName: "",
      vendorId: "",
      cost: "",
      purchaseDate: new Date().toISOString().slice(0, 10),
      warrantyDuration: "",
      warrantyDurationUnit: "months",
      warrantyExpiry: "",
      notes: "",
    };
  });

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [isSavingPart, setIsSavingPart] = useState(false);
  const [customPartName, setCustomPartName] = useState("");

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const handleVendorAdded = (newVendor: Vendor) => {
    onVendorAdded(newVendor);
    setFormData((prev) => ({ ...prev, vendorId: newVendor.id.toString() }));
    setShowAddVendor(false);
  };

  const handleSubmit = async () => {
    if (loading) return;

    const errors: Record<string, string> = {};

    if (!formData.vehicleId) errors.vehicleId = "Vehicle is required";
    if (!formData.partName.trim()) errors.partName = "Part name is required";
    if (!formData.vendorId) errors.vendorId = "Vendor is required";
    if (
      !formData.cost ||
      Number(formData.cost) < 0 ||
      isNaN(Number(formData.cost))
    ) {
      errors.cost = "Valid cost required";
    }
    if (!formData.purchaseDate) errors.purchaseDate = "Purchase date required";
    if (
      !formData.warrantyDuration ||
      parseInt(formData.warrantyDuration) <= 0
    ) {
      errors.warrantyDuration = "Valid warranty duration required";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/warranty", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "edit" ? { id: formData.id } : {}),
        
          vehicle_id: parseInt(formData.vehicleId),
          part_name: formData.partName.trim(),
          vendor_id: parseInt(formData.vendorId),
          cost: Number(formData.cost),
          purchase_date: formData.purchaseDate,
          warranty_duration: parseInt(formData.warrantyDuration),
          warranty_duration_unit: formData.warrantyDurationUnit,
          warranty_expiry: formData.warrantyExpiry || undefined,
          notes: formData.notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setSubmitError(data.error || "Failed to add part");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ModalHeader>
        <ModalTitle>
          {mode === "edit" ? "Edit Warranty Part" : "Add Part with Warranty"}
        </ModalTitle>
        <ModalDescription>
          {mode === "edit"
            ? "Update the part details and warranty information."
            : "Record a part replacement directly — for past repairs or missed entries."}
        </ModalDescription>
      </ModalHeader>

      <ModalBody style={styles.modalBodyPadding}>
        <div style={styles.formSection}>
          {/* Vehicle */}
          <div style={styles.fieldGroup}>
            <Label>
              Vehicle <span style={styles.requiredStar}>*</span>
            </Label>
            <Typeahead
              options={vehicles}
              value={formData.vehicleId}
              disabled={mode === "edit"}
              onValueChange={(val) => {
                setFormData((p) => ({ ...p, vehicleId: val }));
                setFieldErrors((p) => ({ ...p, vehicleId: "" }));
              }}
              getOptionValue={(v) => v.id.toString()}
              getOptionLabel={(v) =>
                `${v.vehicle_number} — ${v.company} ${v.model}`
              }
              getOptionKeywords={(v) => [v.vehicle_number, v.company, v.model]}
              placeholder="Search vehicle..."
              emptyMessage="No vehicles found."
              invalid={Boolean(fieldErrors.vehicleId)}
            />
            {fieldErrors.vehicleId && (
              <span style={styles.fieldError}>{fieldErrors.vehicleId}</span>
            )}
          </div>

          <div style={styles.formRow}>
            {/* Part Name */}
            <div style={styles.formCol}>
              <Label>
                Part Name <span style={styles.requiredStar}>*</span>
              </Label>
              <Typeahead
                id={`${mode}PartTypeahead`}
                options={partOptions}
                value={formData.partName}
                onValueChange={(_val, option) => {
                  if (option) {
                    setFormData((p) => ({ ...p, partName: option.name }));
                    setFieldErrors((p) => ({ ...p, partName: "" }));
                  }
                }}
                getOptionValue={(o) => o.name}
                getOptionLabel={(o) => o.name}
                placeholder="Select Part"
                emptyMessage="No match found."
                invalid={Boolean(fieldErrors.partName)}
                footer={
                  <div
                    style={{
                      padding: "0.25rem",
                      display: "flex",
                      gap: "0.5rem",
                    }}
                  >
                    <Input
                      placeholder="Custom part name..."
                      value={customPartName}
                      onChange={(e) => {
                        setCustomPartName(e.target.value);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSavingPart || !customPartName.trim()}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const trimmed = customPartName.trim();
                        if (!trimmed || isSavingPart) return;

                        const normalizedNew = trimmed
                          .toLowerCase()
                          .replace(/\s+/g, "");
                        const isDuplicate = partOptions.some(
                          (opt) =>
                            opt.name.toLowerCase().replace(/\s+/g, "") ===
                            normalizedNew,
                        );

                        if (isDuplicate) {
                          const existingOpt = partOptions.find(
                            (opt) =>
                              opt.name.toLowerCase().replace(/\s+/g, "") ===
                              normalizedNew,
                          );
                          if (existingOpt) {
                            setFormData((p) => ({
                              ...p,
                              partName: existingOpt.name,
                            }));
                            setFieldErrors((p) => ({ ...p, partName: "" }));
                            setCustomPartName("");
                            // Close the dropdown smoothly
                            const input =
                              document.getElementById(`${mode}PartTypeahead`);
                            if (input) {
                              input.focus();
                              input.dispatchEvent(
                                new KeyboardEvent("keydown", {
                                  key: "Escape",
                                  bubbles: true,
                                }),
                              );
                            }
                          }
                          return;
                        }

                        setIsSavingPart(true);
                        try {
                          const res = await fetch("/api/part-options", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              name: customPartName.trim(),
                            }),
                          });
                          const json = await res.json();
                          if (res.ok && json.data?.partOption) {
                            onPartAdded(json.data.partOption);
                            setFormData((p) => ({
                              ...p,
                              partName: json.data.partOption.name,
                            }));
                            setFieldErrors((p) => ({ ...p, partName: "" }));
                            setCustomPartName("");
                            // Close the dropdown smoothly
                            const input =
                              document.getElementById(`${mode}PartTypeahead`);
                            if (input) {
                              input.focus();
                              input.dispatchEvent(
                                new KeyboardEvent("keydown", {
                                  key: "Escape",
                                  bubbles: true,
                                }),
                              );
                            }
                          } else {
                            if (json.error !== "This part name already exists") {
                              setFieldErrors((p) => ({ ...p, partName: json.error || "Failed to add part option" }));
                            }
                          }
                        } catch {
                          setFieldErrors((p) => ({ ...p, partName: "Network error while adding part option" }));
                        } finally {
                          setIsSavingPart(false);
                        }
                      }}
                    >
                      {isSavingPart ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <PlusIcon size={16} />
                      )}
                    </Button>
                  </div>
                }
              />
              {fieldErrors.partName && (
                <span style={styles.fieldError}>{fieldErrors.partName}</span>
              )}
            </div>

            {/* Vendor */}
            <div style={styles.formCol}>
              <Label>
                Vendor <span style={styles.requiredStar}>*</span>
              </Label>
              <Typeahead
                options={vendors}
                value={formData.vendorId}
                onValueChange={(val) => {
                  setFormData((p) => ({ ...p, vendorId: val }));
                  setFieldErrors((p) => ({ ...p, vendorId: "" }));
                }}
                getOptionValue={(v) => v.id.toString()}
                getOptionLabel={(v) => v.name}
                getOptionDescription={(v) => v.location || undefined}
                placeholder="Search vendor..."
                emptyMessage="No vendors found."
                invalid={Boolean(fieldErrors.vendorId)}
                footer={
                  <Button
                    variant="ghost"
                    type="button"
                    style={styles.addVendorFooterBtn}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setShowAddVendor(true)}
                  >
                    <PlusIcon size={14} />
                    Add New Vendor
                  </Button>
                }
              />
              {fieldErrors.vendorId && (
                <span style={styles.fieldError}>{fieldErrors.vendorId}</span>
              )}
            </div>
          </div>

          <div style={styles.formRow}>
            {/* Cost */}
            <div style={styles.formCol}>
              <Label>
                Cost (₹) <span style={styles.requiredStar}>*</span>
              </Label>
              <Input
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, cost: e.target.value }));
                  setFieldErrors((p) => ({ ...p, cost: "" }));
                }}
                onWheel={(e) => e.currentTarget.blur()}
                style={fieldErrors.cost ? styles.inputError : undefined}
              />
              {fieldErrors.cost && (
                <span style={styles.fieldError}>{fieldErrors.cost}</span>
              )}
            </div>

            {/* Purchase Date */}
            <div style={styles.formCol}>
              <Label>
                Purchase Date <span style={styles.requiredStar}>*</span>
              </Label>
              <Input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((p) => ({
                    ...p,
                    purchaseDate: val,
                    warrantyExpiry: computeExpiryDate(
                      val,
                      p.warrantyDuration,
                      p.warrantyDurationUnit,
                    ),
                  }));
                  setFieldErrors((p) => ({ ...p, purchaseDate: "" }));
                }}
                style={fieldErrors.purchaseDate ? styles.inputError : undefined}
              />
              {fieldErrors.purchaseDate && (
                <span style={styles.fieldError}>{fieldErrors.purchaseDate}</span>
              )}
            </div>
          </div>

          <div style={styles.formRow}>
            {/* Warranty Duration */}
            <div style={styles.formCol}>
              <Label>
                Warranty <span style={styles.requiredStar}>*</span>
              </Label>
              <div style={styles.warrantyInputRow}>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="12"
                  value={formData.warrantyDuration}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((p) => ({
                      ...p,
                      warrantyDuration: val,
                      warrantyExpiry: computeExpiryDate(
                        p.purchaseDate,
                        val,
                        p.warrantyDurationUnit,
                      ),
                    }));
                    setFieldErrors((p) => ({ ...p, warrantyDuration: "" }));
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  style={{
                    ...styles.warrantyInputFlex,
                    ...(fieldErrors.warrantyDuration ? styles.inputError : {}),
                  }}
                />
                <Select
                  value={formData.warrantyDurationUnit}
                  onValueChange={(val: "months" | "years") => {
                    setFormData((p) => ({
                      ...p,
                      warrantyDurationUnit: val,
                      warrantyExpiry: computeExpiryDate(
                        p.purchaseDate,
                        p.warrantyDuration,
                        val,
                      ),
                    }));
                  }}
                >
                  <SelectTrigger style={styles.selectTriggerStyle}>
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="years">Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {fieldErrors.warrantyDuration && (
                <span style={styles.fieldError}>{fieldErrors.warrantyDuration}</span>
              )}
            </div>

            {/* Notes */}
            <div style={styles.formCol}>
              <Label>Expiry Date (auto)</Label>
              <Input
                type="date"
                value={formData.warrantyExpiry}
                readOnly
                style={styles.readOnlyInput}
              />
            </div>
          </div>

          {/* Notes (Full Width) */}
          <div style={styles.fieldGroup}>
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional"
              value={formData.notes}
              onChange={(e) =>
                setFormData((p) => ({ ...p, notes: e.target.value }))
              }
              style={styles.textareaStyle}
            />
          </div>
        </div>

        {submitError && (
          <div style={styles.errorBannerWithMargin}>{submitError}</div>
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
            <SaveIcon size={16} style={styles.saveIconStyle} />
          )}
          {loading ? "Saving..." : mode === "edit" ? "Update Part" : "Add Part"}
        </Button>
      </ModalFooter>

      <AddVendorModal
        isOpen={showAddVendor}
        onClose={() => setShowAddVendor(false)}
        onSuccess={handleVendorAdded}
      />
    </>
  );
};

export function PartModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  initialData,
  vehicles,
  vendors,
  partOptions,
  onVendorAdded,
  onPartAdded,
}: PartModalProps) {
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent style={{ maxWidth: "42rem", padding: 0 }}>
        {isOpen && (
          <PartForm
            mode={mode}
            initialData={initialData}
            onClose={onClose}
            onSuccess={onSuccess}
            vehicles={vehicles}
            vendors={vendors}
            partOptions={partOptions}
            onVendorAdded={onVendorAdded}
            onPartAdded={onPartAdded}
          />
        )}
      </ModalContent>
    </Modal>
  );
}
