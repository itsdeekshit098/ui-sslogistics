"use client";

import React, { useState, useCallback } from "react";
import { XIcon, ZapIcon, SettingsIcon, SaveIcon, PlusIcon, UserPlusIcon } from "@/components/ui/icon";
import type { RepairModalProps } from "./repairModal.types";
import { getDefaultRepairFormData } from "@/components/repairRecordsPage";
import type {
  Technician,
  SpecializationOption,
} from "@/components/techniciansPage";
import type {
  RepairCategory,
  RepairFormData,
} from "@/components/repairRecordsPage";
import { Typeahead } from "@/components/typeahead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { AddTechnicianModal } from "@/components/addTechnicianModal";
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
                  <label style={styles.fieldLabel}>
                    Vehicle
                    {!isEdit && <span style={styles.requiredStar}>*</span>}
                  </label>
                  {isEdit && selectedVehicle ? (
                    <div
                      style={{
                        ...styles.readOnlyBadge,
                        opacity: 0.6,
                        cursor: "not-allowed",
                        backgroundColor: "var(--muted)",
                      }}
                    >
                      {selectedVehicle.vehicle_number} —{" "}
                      {selectedVehicle.company} {selectedVehicle.model}
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
                        <span style={styles.fieldError}>
                          {fieldErrors.vehicleId}
                        </span>
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
                          fieldErrors.date
                            ? { borderColor: "#ef4444" }
                            : undefined
                        }
                      />
                      {fieldErrors.date && (
                        <span style={styles.fieldError}>
                          {fieldErrors.date}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* ── Category (radio-style cards) ── */}
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>
                    Category
                    {!isEdit && <span style={styles.requiredStar}>*</span>}
                  </label>

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
                    <span style={styles.fieldError}>
                      {fieldErrors.category}
                    </span>
                  )}
                </div>

                {/* ── Sub-issues (Typeahead) ── */}
                {formData.category && (
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Specific Issues</label>
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
                      <span style={styles.fieldError}>
                        {fieldErrors.issues}
                      </span>
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
                        <button
                          type="button"
                          style={styles.addTechnicianButton}
                          onPointerDown={(e) => {
                            // Prevent the Typeahead's outside-click handler from
                            // closing the dropdown before this click fires on mobile
                            e.stopPropagation();
                          }}
                          onClick={() => setShowAddTechnician(true)}
                          onMouseEnter={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.backgroundColor = "var(--secondary)";
                          }}
                          onMouseLeave={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.backgroundColor = "var(--background)";
                          }}
                        >
                          <UserPlusIcon size={16} />
                          Add New Technician
                        </button>
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
                        fieldErrors.cost
                          ? { borderColor: "#ef4444" }
                          : undefined
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
                      variant={
                        formData.status === "Closed" ? "default" : "outline"
                      }
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
        <Button
          variant="outline"
          onClick={handleClose}
          disabled={loading}
        >
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
          {loading
            ? "Saving..."
            : isEdit
              ? "Update Record"
              : "Save Record"}
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
            defaultVehicleId={mode === "create" ? props.defaultVehicleId : undefined}
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
