"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  XIcon,
  ZapIcon,
  SettingsIcon,
  SaveIcon,
  PlusIcon,
  UserPlusIcon,
  PackageIcon,
} from "@/components/ui/icon";
import type { RepairModalProps } from "./repairModal.types";
import { getDefaultRepairFormData } from "@/components/repairRecordsPage";
import type {
  Technician,
  SpecializationOption,
} from "@/components/techniciansPage";
import type {
  RepairCategory,
  RepairFormData,
  RepairPartInput,
  Vendor,
  WarrantyDurationUnit,
} from "@/components/repairRecordsPage";
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
import { AddTechnicianModal } from "@/components/addTechnicianModal";
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
import * as styles from "./repairModal.style";
import { computeExpiryDateFromStrings as computeExpiryDate } from "@/utils/warrantyExpiry";

// ─── Part row form shape ───

interface PartFormRow {
  _key: string; // client-side key for React list
  id?: number; // existing DB id (for edit)
  part_name: string;
  vendor_id: string;
  cost: string;
  purchase_date: string;
  warranty_duration: string;
  warranty_duration_unit: WarrantyDurationUnit;
  warranty_expiry: string;
  notes: string;
}

function createPartKey(): string {
  return `part_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createBlankPart(): PartFormRow {
  return {
    _key: createPartKey(),
    part_name: "",
    vendor_id: "",
    cost: "",
    purchase_date: new Date().toISOString().split("T")[0],
    warranty_duration: "12",
    warranty_duration_unit: "months",
    warranty_expiry: "",
    notes: "",
  };
}

// ─── Inner form (mounts/unmounts with modal so state resets) ───

const RepairForm: React.FC<{
  mode: "create" | "edit";
  record?: RepairModalProps extends { record?: infer R } ? R : never;
  defaultVehicleId?: string;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  vehicles: RepairModalProps["vehicles"];
  technicians: RepairModalProps["technicians"];
  specializations: RepairModalProps["specializations"];
  repairOptions: RepairModalProps["repairOptions"];
  onIssueAdded: RepairModalProps["onIssueAdded"];
  onTechnicianAdded: RepairModalProps["onTechnicianAdded"];
  onSpecializationAdded: RepairModalProps["onSpecializationAdded"];
}> = ({
  mode,
  record,
  defaultVehicleId,
  onClose,
  onSuccess,
  vehicles,
  technicians,
  specializations,
  repairOptions,
  onIssueAdded,
  onTechnicianAdded,
  onSpecializationAdded,
}) => {
  const isEdit = mode === "edit";

  const [formData, setFormData] = useState<RepairFormData>(() => {
    if (isEdit && record) {
      return {
        vehicleId: record.vehicle_id.toString(),
        category: record.category,
        issues: [...record.issues],
        date: record.repair_date.split("T")[0],
        technicianId: record.technician_id?.toString() || "",
        cost: record.cost ? record.cost.toString() : "",
        description: record.description || "",
        status: record.status,
      };
    }
    return {
      ...getDefaultRepairFormData(),
      vehicleId: defaultVehicleId || "",
    };
  });

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [customIssue, setCustomIssue] = useState("");

  const [showAddTechnician, setShowAddTechnician] = useState(false);
  const [addingIssue, setAddingIssue] = useState(false);

  // ── Parts state ──
  const [showParts, setShowParts] = useState(false);
  const [parts, setParts] = useState<PartFormRow[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [partOptions, setPartOptions] = useState<
    { id: number; name: string }[]
  >([]);
  const [activeVendorPartIdx, setActiveVendorPartIdx] = useState<number | null>(
    null,
  );
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [customPartNames, setCustomPartNames] = useState<
    Record<string, string>
  >({});
  const [isSavingPart, setIsSavingPart] = useState(false);

  // Populate parts from record on edit
  useEffect(() => {
    if (
      isEdit &&
      record &&
      (record as unknown as { parts?: unknown[] }).parts
    ) {
      const existingParts = (
        record as unknown as {
          parts: Array<{
            id: number;
            part_name: string;
            vendor_id: number;
            cost: number;
            purchase_date: string;
            warranty_duration: number;
            warranty_duration_unit: WarrantyDurationUnit;
            warranty_expiry: string | null;
            notes: string | null;
          }>;
        }
      ).parts;
      if (existingParts.length > 0) {
        setShowParts(true);
        setParts(
          existingParts.map((p) => ({
            _key: createPartKey(),
            id: p.id,
            part_name: p.part_name,
            vendor_id: p.vendor_id.toString(),
            cost: p.cost.toString(),
            purchase_date: p.purchase_date.split("T")[0],
            warranty_duration: p.warranty_duration.toString(),
            warranty_duration_unit: p.warranty_duration_unit,
            warranty_expiry: p.warranty_expiry
              ? p.warranty_expiry.split("T")[0]
              : "",
            notes: p.notes || "",
          })),
        );
      }
    }
  }, [isEdit, record]);

  // Fetch vendors and part options when parts section opens
  useEffect(() => {
    if (!showParts) return;
    if (vendors.length === 0) {
      fetch("/api/vendors?pageSize=100")
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setVendors(d.data.data);
        })
        .catch(() => {});
    }
    if (partOptions.length === 0) {
      fetch("/api/part-options?limit=100")
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setPartOptions(d.data.data);
        })
        .catch(() => {});
    }
  }, [showParts, vendors.length, partOptions.length]);

  const handleVendorAdded = (newVendor: Vendor) => {
    setVendors((prev) => [...prev, newVendor]);
    if (activeVendorPartIdx !== null) {
      handlePartChange(activeVendorPartIdx, "vendor_id", newVendor.id.toString());
    }
    setActiveVendorPartIdx(null);
    setShowAddVendor(false);
  };

  const handlePartChange = (
    index: number,
    field: keyof PartFormRow,
    value: string,
  ) => {
    setParts((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const updated = { ...p, [field]: value };
        // Auto-compute expiry when purchase_date, duration, or unit changes
        if (
          field === "purchase_date" ||
          field === "warranty_duration" ||
          field === "warranty_duration_unit"
        ) {
          updated.warranty_expiry = computeExpiryDate(
            updated.purchase_date,
            updated.warranty_duration,
            updated.warranty_duration_unit,
          );
        }
        return updated;
      }),
    );
  };

  const addPartRow = () => {
    setParts((prev) => [...prev, createBlankPart()]);
  };

  const removePartRow = (index: number) => {
    setParts((prev) => prev.filter((_, i) => i !== index));
    if (parts.length <= 1) {
      setShowParts(false);
    }
  };

  const handleSpecializationAdded = (newSpec: SpecializationOption) => {
    onSpecializationAdded(newSpec);
  };

  const handleTechnicianAdded = (newTech: Technician) => {
    onTechnicianAdded(newTech);
    setFormData((prev) => ({ ...prev, technicianId: newTech.id.toString() }));
    setShowAddTechnician(false);
  };

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  // ─── Category selection ───

  const handleCategorySelect = (cat: RepairCategory) => {
    if (isEdit) return; // locked in edit mode
    setFormData((prev) => ({
      ...prev,
      category: cat,
      issues: [], // clear sub-issues when switching category
    }));
    setFieldErrors((prev) => ({ ...prev, category: "", issues: "" }));
    setSubmitError(null);
  };

  // ─── Add custom issue ───

  const addCustomIssue = async () => {
    const trimmed = customIssue.trim();
    if (!trimmed || !formData.category) return;

    // Prevent duplicate additions locally first
    const existingOptions = repairOptions[formData.category] || [];
    const normalizedNew = trimmed.toLowerCase().replace(/\s+/g, "");

    const isDuplicate =
      existingOptions.some(
        (opt) => opt.toLowerCase().replace(/\s+/g, "") === normalizedNew,
      ) ||
      formData.issues.some(
        (issue) => issue.toLowerCase().replace(/\s+/g, "") === normalizedNew,
      );

    if (isDuplicate) {
      setFieldErrors((prev) => ({
        ...prev,
        issues: "A similar issue already exists.",
      }));
      return;
    }

    setAddingIssue(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/repair-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formData.category,
          name: trimmed,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        const newIssueName = data.data.issue.name;
        // Notify parent to update shared state
        onIssueAdded(formData.category!, newIssueName);
        // Select it automatically
        setFormData((prev) => ({
          ...prev,
          issues: [...prev.issues, newIssueName],
        }));
        setCustomIssue("");
        setFieldErrors((prev) => ({ ...prev, issues: "" }));
      } else {
        setFieldErrors((prev) => ({
          ...prev,
          issues: data.error || "Failed to add issue",
        }));
      }
    } catch {
      setFieldErrors((prev) => ({
        ...prev,
        issues: "Network error while adding issue",
      }));
    } finally {
      setAddingIssue(false);
    }
  };

  // ─── Input change ───

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setFieldErrors((prev) => ({ ...prev, [id]: "" }));
    setSubmitError(null);
  };

  // ─── Status toggle (edit mode only) ───

  const handleStatusToggle = () => {
    setFormData((prev) => ({
      ...prev,
      status: prev.status === "Open" ? "Closed" : "Open",
    }));
  };

  // ─── Build parts payload for API ───

  const buildPartsPayload = (): RepairPartInput[] => {
    return parts.map((p) => ({
      id: p.id,
      part_name: p.part_name,
      vendor_id: parseInt(p.vendor_id),
      cost: Number(p.cost),
      purchase_date: p.purchase_date,
      warranty_duration: parseInt(p.warranty_duration),
      warranty_duration_unit: p.warranty_duration_unit,
      warranty_expiry: p.warranty_expiry || undefined,
      notes: p.notes || undefined,
    }));
  };

  // ─── Validation + Submit ───

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!isEdit && !formData.vehicleId) {
      errors.vehicleId = "Vehicle is required";
    }
    if (!formData.category) {
      errors.category = "Category is required";
    }
    if (formData.issues.length === 0) {
      errors.issues = "Select at least one issue";
    }
    if (!formData.date) {
      errors.date = "Date is required";
    }
    if (!formData.technicianId) {
      errors.technicianId = "Technician is required";
    }

    // Strict cost validation
    if (!formData.cost || formData.cost.trim() === "") {
      errors.cost = "Cost is required";
    } else {
      const parsedCost = Number(formData.cost);
      if (isNaN(parsedCost) || !isFinite(parsedCost)) {
        errors.cost = "Please enter a valid number";
      } else if (parsedCost < 0) {
        errors.cost = "Cost must be ≥ 0";
      }
    }

    // Parts validation
    if (showParts && parts.length > 0) {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!p.part_name.trim()) {
          errors[`part_${i}_name`] = `Part #${i + 1}: name required`;
          break;
        }
        if (!p.vendor_id) {
          errors[`part_${i}_vendor`] = `Part #${i + 1}: vendor required`;
          break;
        }
        if (!p.cost || Number(p.cost) < 0 || isNaN(Number(p.cost))) {
          errors[`part_${i}_cost`] = `Part #${i + 1}: valid cost required`;
          break;
        }
        if (!p.purchase_date) {
          errors[`part_${i}_date`] = `Part #${i + 1}: purchase date required`;
          break;
        }
        if (!p.warranty_duration || parseInt(p.warranty_duration) <= 0) {
          errors[`part_${i}_warranty`] =
            `Part #${i + 1}: warranty duration required`;
          break;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitError("Please fix the validation errors below.");
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const url = "/api/repair-records";
      let response: Response;

      if (isEdit && record) {
        // PUT
        response = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: record.id,
            issues: formData.issues,
            description: formData.description || undefined,
            cost: Number(formData.cost),
            technician_id: parseInt(formData.technicianId),
            status: formData.status,
            parts: showParts ? buildPartsPayload() : [],
          }),
        });
      } else {
        // POST
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicle_id: parseInt(formData.vehicleId),
            repair_date: new Date(formData.date).toISOString(),
            category: formData.category,
            issues: formData.issues,
            description: formData.description || undefined,
            cost: Number(formData.cost),
            technician_id: parseInt(formData.technicianId),
            parts: showParts ? buildPartsPayload() : undefined,
          }),
        });
      }

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

  // ─── Selected vehicle info ───
  const selectedVehicle = vehicles.find(
    (v) => v.id.toString() === formData.vehicleId,
  );

  return (
    <>
      <ModalHeader>
        <ModalTitle>
          {isEdit ? "Edit Repair Record" : "New Repair Record"}
        </ModalTitle>
        <ModalDescription>
          {isEdit
            ? "Update repair details or close this record."
            : "Record a new repair entry for a vehicle."}
        </ModalDescription>
      </ModalHeader>

      <ModalBody style={{ padding: "1.5rem" }}>
        <div style={styles.formSection}>
          {/* ── Vehicle ── */}
          <div style={styles.fieldGroup}>
            <Label style={styles.fieldLabel}>
              Vehicle
              {!isEdit && <span style={styles.requiredStar}>*</span>}
            </Label>
            {isEdit && selectedVehicle ? (
              <div
                style={{
                  ...styles.readOnlyBadge,
                  opacity: 0.6,
                  cursor: "not-allowed",
                  backgroundColor: "var(--muted)",
                }}
              >
                {selectedVehicle.vehicle_number} — {selectedVehicle.company}{" "}
                {selectedVehicle.model}
              </div>
            ) : (
              <>
                <Typeahead
                  id="vehicleId"
                  options={vehicles}
                  value={formData.vehicleId}
                  onValueChange={(vehicleId) => {
                    setFormData((prev) => ({ ...prev, vehicleId }));
                    setFieldErrors((prev) => ({
                      ...prev,
                      vehicleId: "",
                    }));
                    setSubmitError(null);
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
                  placeholder="Search vehicle..."
                  emptyMessage="No vehicles found."
                  invalid={Boolean(fieldErrors.vehicleId)}
                />
                {fieldErrors.vehicleId && (
                  <span style={styles.fieldError}>{fieldErrors.vehicleId}</span>
                )}
              </>
            )}
          </div>

          {/* ── Date ── */}
          <div style={styles.fieldGroup}>
            <Label htmlFor="date">
              Date <span style={styles.requiredStar}>*</span>
            </Label>
            {isEdit ? (
              <div
                style={{
                  ...styles.readOnlyBadge,
                  opacity: 0.6,
                  cursor: "not-allowed",
                  backgroundColor: "var(--muted)",
                }}
              >
                {formData.date}
              </div>
            ) : (
              <>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  style={
                    fieldErrors.date ? { borderColor: "#ef4444" } : undefined
                  }
                />
                {fieldErrors.date && (
                  <span style={styles.fieldError}>{fieldErrors.date}</span>
                )}
              </>
            )}
          </div>

          {/* ── Category (radio-style cards) ── */}
          <div style={styles.fieldGroup}>
            <Label style={styles.fieldLabel}>
              Category
              {!isEdit && <span style={styles.requiredStar}>*</span>}
            </Label>

            {isEdit ? (
              <div
                style={{
                  ...styles.readOnlyBadge,
                  opacity: 0.6,
                  cursor: "not-allowed",
                  backgroundColor: "var(--muted)",
                }}
              >
                {formData.category === "electrical" ? (
                  <ZapIcon
                    size={16}
                    style={{ color: "#38bdf8", fill: "#38bdf8" }}
                  />
                ) : (
                  <SettingsIcon
                    size={16}
                    style={{ color: "#f97316", fill: "#f97316" }}
                  />
                )}
                <span style={{ textTransform: "capitalize" }}>
                  {formData.category}
                </span>
              </div>
            ) : (
              <div style={styles.categoryGrid}>
                {/* Electrical */}
                <div
                  style={{
                    ...styles.categoryCardBase,
                    ...(formData.category === "electrical"
                      ? styles.categoryCardSelected
                      : {}),
                  }}
                  onClick={() => handleCategorySelect("electrical")}
                >
                  <div>
                    <div style={styles.categoryLabel}>Electrical</div>
                    <div style={styles.categoryHint}>
                      Battery, lights, wiring…
                    </div>
                  </div>
                  <ZapIcon
                    size={20}
                    style={{ color: "#38bdf8", fill: "#38bdf8" }}
                  />
                </div>

                {/* Mechanical */}
                <div
                  style={{
                    ...styles.categoryCardBase,
                    ...(formData.category === "mechanical"
                      ? styles.categoryCardSelected
                      : {}),
                  }}
                  onClick={() => handleCategorySelect("mechanical")}
                >
                  <div>
                    <div style={styles.categoryLabel}>Mechanical</div>
                    <div style={styles.categoryHint}>
                      Engine, brakes, clutch…
                    </div>
                  </div>
                  <SettingsIcon
                    size={20}
                    style={{ color: "#f97316", fill: "#f97316" }}
                  />
                </div>
              </div>
            )}

            {fieldErrors.category && (
              <span style={styles.fieldError}>{fieldErrors.category}</span>
            )}
          </div>

          {/* ── Sub-issues (Typeahead) ── */}
          {formData.category && (
            <div style={styles.fieldGroup}>
              <Label style={styles.fieldLabel}>Specific Issues</Label>
              <Typeahead
                placeholder={
                  formData.category
                    ? `Search ${formData.category.toLowerCase()} issues...`
                    : "Select a category first"
                }
                options={
                  formData.category && repairOptions[formData.category]
                    ? repairOptions[formData.category].map((name) => ({
                        id: name,
                        name,
                      }))
                    : []
                }
                value="" // Empty so we can pick multiple
                onValueChange={(_val, option) => {
                  if (option && !formData.issues.includes(option.name)) {
                    setFormData((prev) => ({
                      ...prev,
                      issues: [...prev.issues, option.name],
                    }));
                    setFieldErrors((prev) => ({ ...prev, issues: "" }));
                  }
                }}
                getOptionLabel={(opt) => opt.name}
                getOptionValue={(opt) => opt.id}
                disabled={!formData.category}
                emptyMessage="No matching issues found."
                footer={
                  <div
                    style={{ padding: "0.25rem" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <div style={styles.customIssueRow}>
                      <Input
                        placeholder="Other issue not listed..."
                        value={customIssue}
                        onChange={(e) => {
                          setCustomIssue(e.target.value);
                          setFieldErrors((prev) => ({
                            ...prev,
                            issues: "",
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomIssue();
                          }
                        }}
                        style={{ flex: 1 }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addCustomIssue}
                        disabled={!customIssue.trim() || addingIssue}
                        style={{ flexShrink: 0 }}
                      >
                        {addingIssue ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <PlusIcon
                            size={16}
                            style={{ marginRight: "0.25rem" }}
                          />
                        )}
                        Add
                      </Button>
                    </div>
                  </div>
                }
              />

              {/* Selected Issues Chips */}
              {formData.issues.length > 0 && (
                <div style={{ ...styles.issueGrid, marginTop: "0.5rem" }}>
                  {formData.issues.map((issue) => (
                    <div
                      key={issue}
                      style={{
                        ...styles.issueChipBase,
                        ...styles.issueChipSelected,
                      }}
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          issues: prev.issues.filter((i) => i !== issue),
                        }));
                      }}
                    >
                      {issue}
                      <span style={styles.customChipRemove}>
                        <XIcon size={12} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {fieldErrors.issues && (
                <span style={styles.fieldError}>{fieldErrors.issues}</span>
              )}
            </div>
          )}

          {/* ── Technician & Cost ── */}
          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <Label htmlFor="technician">
                Technician <span style={styles.requiredStar}>*</span>
              </Label>
              <Typeahead
                id="technicianId"
                options={technicians}
                value={formData.technicianId}
                onValueChange={(technicianId) => {
                  const tech = technicians.find(
                    (t) => t.id.toString() === technicianId,
                  );
                  if (tech && !tech.is_active) return; // Prevent selecting inactive
                  setFormData((prev) => ({ ...prev, technicianId }));
                  setFieldErrors((prev) => ({
                    ...prev,
                    technicianId: "",
                  }));
                  setSubmitError(null);
                }}
                getOptionValue={(t) => t.id.toString()}
                getOptionLabel={(t) =>
                  t.is_active ? t.name : `${t.name} (Inactive)`
                }
                getOptionDescription={(t) => t.specializations.join(", ")}
                getOptionKeywords={(t) => [
                  t.name,
                  ...(t.specializations || []),
                ]}
                placeholder="Search technician..."
                emptyMessage="No technicians found."
                invalid={Boolean(fieldErrors.technicianId)}
                footer={
                  <Button
                    variant="ghost"
                    type="button"
                    style={styles.addTechnicianButton}
                    onPointerDown={(e) => {
                      // Prevent the Typeahead's outside-click handler from
                      // closing the dropdown before this click fires on mobile
                      e.stopPropagation();
                    }}
                    onClick={() => setShowAddTechnician(true)}
                  >
                    <UserPlusIcon size={16} />
                    Add New Technician
                  </Button>
                }
              />
              {fieldErrors.technicianId && (
                <span style={styles.fieldError}>
                  {fieldErrors.technicianId}
                </span>
              )}
            </div>
            <div style={styles.fieldGroup}>
              <Label htmlFor="cost">
                Cost (₹) <span style={styles.requiredStar}>*</span>
              </Label>
              <Input
                id="cost"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={handleChange}
                onWheel={(e) => e.currentTarget.blur()}
                style={
                  fieldErrors.cost ? { borderColor: "#ef4444" } : undefined
                }
              />
              {fieldErrors.cost && (
                <span style={styles.fieldError}>{fieldErrors.cost}</span>
              )}
            </div>
          </div>

          {/* ── Description ── */}
          <div style={styles.fieldGroup}>
            <Label htmlFor="description">Description / Notes</Label>
            <Textarea
              id="description"
              placeholder="Describe the work done or parts replaced..."
              value={formData.description}
              onChange={handleChange}
              rows={3}
            />
          </div>

          {/* ── Parts Toggle ── */}
          <div>
            <div
              style={{
                ...styles.partsToggle,
                ...(showParts ? styles.partsToggleActive : {}),
              }}
              onClick={() => {
                const next = !showParts;
                setShowParts(next);
                if (next && parts.length === 0) {
                  setParts([createBlankPart()]);
                }
              }}
              role="button"
              aria-pressed={showParts}
              aria-label="Add replaced parts with warranty"
            >
              <div>
                <div style={styles.partsToggleLabel}>
                  <PackageIcon
                    size={16}
                    style={{ marginRight: "0.375rem", verticalAlign: "middle" }}
                  />
                  Parts replaced with warranty?
                </div>
                <div style={styles.partsToggleHint}>
                  Add parts replaced during this repair (record vendor, cost,
                  purchase date and warranty).
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted-foreground)",
                }}
              >
                {showParts ? "▼" : "▶"}
              </div>
            </div>

            {/* ── Parts Form ── */}
            {showParts && (
              <div style={styles.partsSection}>
                {parts.map((part, idx) => (
                  <div key={part._key} style={styles.partCard}>
                    <div style={styles.partCardHeader}>
                      <span style={styles.partCardTitle}>Part #{idx + 1}</span>
                      {idx > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          style={styles.partRemoveButton}
                          onClick={() => removePartRow(idx)}
                          aria-label={`Remove part ${idx + 1}`}
                        >
                          <XIcon size={14} />
                        </Button>
                      )}
                    </div>

                    <div style={styles.partFormGrid}>
                      {/* Part Name */}
                      <div style={styles.fieldGroup}>
                        <Label>Part Name *</Label>
                        <Typeahead
                          id={`repairPartTypeahead_${part._key}`}
                          options={partOptions}
                          value={part.part_name}
                          onValueChange={(_val, option) => {
                            if (option) {
                              handlePartChange(idx, "part_name", option.name);
                              setFieldErrors((prev) => ({
                                ...prev,
                                [`part_${idx}_name`]: "",
                              }));
                            }
                          }}
                          getOptionValue={(o) => o.name}
                          getOptionLabel={(o) => o.name}
                          placeholder="Select Part"
                          emptyMessage="No match found."
                          invalid={Boolean(fieldErrors[`part_${idx}_name`])}
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
                                value={customPartNames[part._key] || ""}
                                onChange={(e) =>
                                  setCustomPartNames((prev) => ({
                                    ...prev,
                                    [part._key]: e.target.value,
                                  }))
                                }
                                onPointerDown={(e) => e.stopPropagation()}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                  isSavingPart ||
                                  !(customPartNames[part._key] || "").trim()
                                }
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const customName = (
                                    customPartNames[part._key] || ""
                                  ).trim();
                                  if (!customName || isSavingPart) return;

                                  // 1. Local duplicate check — select existing without hitting API
                                  const normalizedNew = customName
                                    .toLowerCase()
                                    .replace(/\s+/g, "");
                                  const existingOpt = partOptions.find(
                                    (opt) =>
                                      opt.name
                                        .toLowerCase()
                                        .replace(/\s+/g, "") === normalizedNew,
                                  );
                                  if (existingOpt) {
                                    handlePartChange(
                                      idx,
                                      "part_name",
                                      existingOpt.name,
                                    );
                                    setFieldErrors((prev) => ({
                                      ...prev,
                                      [`part_${idx}_name`]: "",
                                    }));
                                    setCustomPartNames((prev) => ({
                                      ...prev,
                                      [part._key]: "",
                                    }));
                                    // Close the dropdown smoothly
                                    const input = document.getElementById(
                                      `repairPartTypeahead_${part._key}`,
                                    );
                                    if (input) {
                                      input.focus();
                                      input.dispatchEvent(
                                        new KeyboardEvent("keydown", {
                                          key: "Escape",
                                          bubbles: true,
                                        }),
                                      );
                                    }
                                    return;
                                  }

                                  // 2. Not found locally — POST to create
                                  setIsSavingPart(true);
                                  try {
                                    const res = await fetch(
                                      "/api/part-options",
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          name: customName,
                                        }),
                                      },
                                    );
                                    const json = await res.json();
                                    if (res.ok && json.data?.partOption) {
                                      setPartOptions((prev) => [
                                        ...prev,
                                        json.data.partOption,
                                      ]);
                                      handlePartChange(
                                        idx,
                                        "part_name",
                                        json.data.partOption.name,
                                      );
                                      setFieldErrors((prev) => ({
                                        ...prev,
                                        [`part_${idx}_name`]: "",
                                      }));
                                      setCustomPartNames((prev) => ({
                                        ...prev,
                                        [part._key]: "",
                                      }));
                                      // Close the dropdown smoothly
                                      const input = document.getElementById(
                                        `repairPartTypeahead_${part._key}`,
                                      );
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
                                      // API says already exists but local check missed it — show inline error
                                      setFieldErrors((prev) => ({
                                        ...prev,
                                        [`part_${idx}_name`]:
                                          json.error !== "This part name already exists"
                                            ? json.error || "Failed to add part option"
                                            : "This part already exists — search for it above",
                                      }));
                                    }
                                  } catch {
                                    setFieldErrors((prev) => ({
                                      ...prev,
                                      [`part_${idx}_name`]:
                                        "Network error while adding part option",
                                    }));
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
                        {fieldErrors[`part_${idx}_name`] && (
                          <span style={styles.fieldError}>
                            {fieldErrors[`part_${idx}_name`]}
                          </span>
                        )}
                      </div>

                      {/* Vendor */}
                      <div style={styles.fieldGroup}>
                        <Label>Vendor *</Label>
                        <Typeahead
                          options={vendors}
                          value={part.vendor_id}
                          onValueChange={(val) =>
                            handlePartChange(idx, "vendor_id", val)
                          }
                          getOptionValue={(v) => v.id.toString()}
                          getOptionLabel={(v) => v.name}
                          getOptionDescription={(v) => v.location || undefined}
                          placeholder="Search vendor..."
                          emptyMessage="No vendors found."
                          footer={
                            <Button
                              variant="ghost"
                              type="button"
                              style={styles.addVendorFooterButton}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => {
                                setActiveVendorPartIdx(idx);
                                setShowAddVendor(true);
                              }}
                            >
                              <PlusIcon size={14} />
                              Add New Vendor
                            </Button>
                          }
                        />
                      </div>

                      {/* Cost */}
                      <div style={styles.fieldGroup}>
                        <Label>Cost (₹) *</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={part.cost}
                          onChange={(e) =>
                            handlePartChange(idx, "cost", e.target.value)
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                          style={fieldErrors[`part_${idx}_cost`] ? styles.inputError : undefined}
                        />
                        {fieldErrors[`part_${idx}_cost`] && (
                          <span style={styles.fieldError}>
                            {fieldErrors[`part_${idx}_cost`]}
                          </span>
                        )}
                      </div>

                      {/* Purchase Date */}
                      <div style={styles.fieldGroup}>
                        <Label>Purchase Date *</Label>
                        <Input
                          type="date"
                          value={part.purchase_date}
                          onChange={(e) =>
                            handlePartChange(
                              idx,
                              "purchase_date",
                              e.target.value,
                            )
                          }
                          style={fieldErrors[`part_${idx}_date`] ? styles.inputError : undefined}
                        />
                        {fieldErrors[`part_${idx}_date`] && (
                          <span style={styles.fieldError}>
                            {fieldErrors[`part_${idx}_date`]}
                          </span>
                        )}
                      </div>

                      {/* Warranty Duration */}
                      <div style={styles.fieldGroup}>
                        <Label>Warranty *</Label>
                        <div style={styles.warrantyInputRow}>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="12"
                            value={part.warranty_duration}
                            onChange={(e) =>
                              handlePartChange(
                                idx,
                                "warranty_duration",
                                e.target.value,
                              )
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            style={{
                              ...styles.warrantyInputFlex,
                              ...(fieldErrors[`part_${idx}_warranty`] ? styles.inputError : {}),
                            }}
                          />
                          <Select
                            value={part.warranty_duration_unit}
                            onValueChange={(val: "months" | "years") =>
                              handlePartChange(
                                idx,
                                "warranty_duration_unit",
                                val,
                              )
                            }
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
                        {fieldErrors[`part_${idx}_warranty`] && (
                          <span style={styles.fieldError}>
                            {fieldErrors[`part_${idx}_warranty`]}
                          </span>
                        )}
                      </div>

                      {/* Notes */}
                      <div style={styles.fieldGroup}>
                        <Label>Expiry Date (auto)</Label>
                        <Input
                          type="date"
                          value={part.warranty_expiry}
                          readOnly
                          style={styles.readOnlyInput}
                        />
                      </div>
                    </div>

                    {/* Notes (Full Width) */}
                    <div style={{ ...styles.fieldGroup, marginTop: "1rem" }}>
                      <Label>Notes</Label>
                      <Textarea
                        placeholder="Optional"
                        value={part.notes}
                        onChange={(e) =>
                          handlePartChange(idx, "notes", e.target.value)
                        }
                        style={styles.textareaStyle}
                      />
                    </div>

                    {/* Part-level error display */}
                    {Object.keys(fieldErrors)
                      .filter((k) => k.startsWith(`part_${idx}_`))
                      .map((k) => (
                        <span key={k} style={styles.fieldError}>
                          {fieldErrors[k]}
                        </span>
                      ))}
                  </div>
                ))}

                <Button
                  variant="ghost"
                  type="button"
                  style={styles.addPartButton}
                  onClick={addPartRow}
                >
                  <PlusIcon size={14} />
                  Add another part
                </Button>
              </div>
            )}
          </div>

          {/* ── Status Toggle (edit only) ── */}
          {isEdit && (
            <div style={styles.statusSection}>
              <div>
                <div style={styles.statusLabel}>Status</div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {formData.status === "Open"
                    ? "This repair is currently open"
                    : "This repair has been closed"}
                </div>
              </div>
              <Button
                type="button"
                variant={formData.status === "Closed" ? "default" : "outline"}
                onClick={handleStatusToggle}
                style={{ minWidth: "6rem" }}
              >
                {formData.status === "Open" ? "Mark Closed" : "Reopen"}
              </Button>
            </div>
          )}
        </div>

        {/* ── Error banner ── */}
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
            <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
          )}
          {loading ? "Saving..." : isEdit ? "Update Record" : "Save Record"}
        </Button>
      </ModalFooter>

      {/* ── Stacked Add Technician Modal ── */}
      <AddTechnicianModal
        isOpen={showAddTechnician}
        onClose={() => setShowAddTechnician(false)}
        onSuccess={handleTechnicianAdded}
        onSpecializationAdded={handleSpecializationAdded}
        specializations={specializations}
        mode="nested"
      />

      {/* ── Stacked Add Vendor Modal ── */}
      <AddVendorModal
        isOpen={showAddVendor}
        onClose={() => setShowAddVendor(false)}
        onSuccess={handleVendorAdded}
      />
    </>
  );
};

// ─── Wrapper — conditionally mounts/unmounts form for state reset ───

const RepairModal: React.FC<RepairModalProps> = (props) => {
  const {
    isOpen,
    onClose,
    onSuccess,
    vehicles,
    technicians,
    specializations,
    repairOptions,
    onIssueAdded,
    onTechnicianAdded,
    onSpecializationAdded,
    mode,
  } = props;

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent style={{ maxWidth: "48rem", padding: 0 }}>
        {isOpen && (
          <RepairForm
            mode={mode}
            record={mode === "edit" ? props.record : undefined}
            defaultVehicleId={
              mode === "create" ? props.defaultVehicleId : undefined
            }
            onClose={onClose}
            onSuccess={onSuccess}
            vehicles={vehicles}
            technicians={technicians}
            specializations={specializations}
            repairOptions={repairOptions}
            onIssueAdded={onIssueAdded}
            onTechnicianAdded={onTechnicianAdded}
            onSpecializationAdded={onSpecializationAdded}
          />
        )}
      </ModalContent>
    </Modal>
  );
};

export default RepairModal;
