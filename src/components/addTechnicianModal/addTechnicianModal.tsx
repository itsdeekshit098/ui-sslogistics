"use client";

import React, { useState, useEffect, useCallback } from "react";
import { XIcon, SaveIcon, PlusIcon } from "@/components/ui/icon";
import type { AddTechnicianModalProps } from "./addTechnicianModal.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/loadingSpinner";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import * as styles from "./addTechnicianModal.style";

const PHONE_REGEX = /^[6-9]\d{9}$/;

const AddTechnicianForm: React.FC<{
  onClose: () => void;
  onSuccess: AddTechnicianModalProps["onSuccess"];
  specializations: AddTechnicianModalProps["specializations"];
  onSpecializationAdded?: AddTechnicianModalProps["onSpecializationAdded"];
  technicianToEdit?: AddTechnicianModalProps["technicianToEdit"];
}> = ({
  onClose,
  onSuccess,
  specializations: initialSpecializations,
  onSpecializationAdded,
  technicianToEdit,
}) => {
  const isEdit = !!technicianToEdit;
  const [localSpecializations, setLocalSpecializations] = useState(
    initialSpecializations,
  );

  useEffect(() => {
    setLocalSpecializations(initialSpecializations);
  }, [initialSpecializations]);

  const [formData, setFormData] = useState({
    name: technicianToEdit?.name || "",
    phone: technicianToEdit?.phone || "",
    location: technicianToEdit?.location || "",
    specializations: technicianToEdit
      ? [...technicianToEdit.specializations]
      : ([] as string[]),
  });

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [customSpec, setCustomSpec] = useState("");

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const toggleSpecialization = (specName: string) => {
    setFormData((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(specName)
        ? prev.specializations.filter((s) => s !== specName)
        : [...prev.specializations, specName],
    }));
  };

  const addCustomSpecialization = async () => {
    const trimmed = customSpec.trim();
    if (!trimmed) return;

    if (formData.specializations.includes(trimmed)) {
      setCustomSpec("");
      return;
    }

    try {
      const res = await fetch("/api/specializations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (res.ok) {
        const json = await res.json();
        const newSpec = json.data?.specialization;
        if (newSpec && !localSpecializations.find((s) => s.id === newSpec.id)) {
          setLocalSpecializations((prev) => [...prev, newSpec]);
          onSpecializationAdded?.(newSpec);
        }
      }
    } catch {
      // specialization save failed silently
    }

    setFormData((prev) => ({
      ...prev,
      specializations: [...prev.specializations, trimmed],
    }));
    setCustomSpec("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setFieldErrors((prev) => ({ ...prev, [id]: "" }));
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }

    if (formData.phone.trim() && !PHONE_REGEX.test(formData.phone.trim())) {
      errors.phone = "Invalid Indian mobile number (10 digits)";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      let res;
      if (isEdit && technicianToEdit) {
        res = await fetch("/api/technicians", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: technicianToEdit.id,
            name: formData.name.trim(),
            phone: formData.phone.trim() || undefined,
            location: formData.location.trim() || undefined,
            specializations: formData.specializations,
          }),
        });
      } else {
        res = await fetch("/api/technicians", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            phone: formData.phone.trim() || undefined,
            location: formData.location.trim() || undefined,
            specializations: formData.specializations,
          }),
        });
      }

      const data = await res.json();

      if (res.ok) {
        onSuccess(data.data.technician);
        setLoading(false);
        onClose();
      } else {
        setSubmitError(data.error || "Failed to save technician");
        setLoading(false);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
      setLoading(false);
    }
  };

  return (
    <>
      <ModalHeader>
        <ModalTitle>{isEdit ? "Edit Technician" : "Add New Technician"}</ModalTitle>
        <ModalDescription>
          {isEdit
            ? "Update technician details and specializations."
            : "Create a new technician profile."}
        </ModalDescription>
      </ModalHeader>

      <ModalBody style={{ padding: "1.5rem" }}>
        <div style={styles.formSection}>
        <div style={styles.fieldGroup}>
          <Label htmlFor="name">
            Name <span style={styles.requiredStar}>*</span>
          </Label>
          <Input
            id="name"
            placeholder="Technician name"
            value={formData.name}
            onChange={handleChange}
            style={
              fieldErrors.name ? { borderColor: "#ef4444" } : undefined
            }
          />
          {fieldErrors.name && (
            <span style={styles.fieldError}>{fieldErrors.name}</span>
          )}
        </div>

        <div style={styles.fieldGroup}>
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            placeholder="10-digit mobile number"
            value={formData.phone}
            onChange={handleChange}
            style={
              fieldErrors.phone ? { borderColor: "#ef4444" } : undefined
            }
          />
          {fieldErrors.phone && (
            <span style={styles.fieldError}>{fieldErrors.phone}</span>
          )}
        </div>

        <div style={styles.fieldGroup}>
          <Label htmlFor="location">Location / Address</Label>
          <Input
            id="location"
            placeholder="Workshop location"
            value={formData.location}
            onChange={handleChange}
          />
        </div>

        <div style={styles.fieldGroup}>
          <Label style={styles.fieldLabel}>Specializations</Label>
          <div style={styles.issueGrid}>
            {localSpecializations.map((spec) => {
              const selected = formData.specializations.includes(spec.name);
              return (
                <div
                  key={spec.id}
                  style={{
                    ...styles.issueChipBase,
                    ...(selected ? styles.issueChipSelected : {}),
                  }}
                  onClick={() => toggleSpecialization(spec.name)}
                >
                  {spec.name}
                </div>
              );
            })}
            {/* Custom specializations not in the db options yet */}
            {formData.specializations
              .filter(
                (s) => !localSpecializations.find((opt) => opt.name === s),
              )
              .map((custom) => (
                <div
                  key={custom}
                  style={{
                    ...styles.issueChipBase,
                    ...styles.issueChipSelected,
                  }}
                  onClick={() => toggleSpecialization(custom)}
                >
                  {custom}
                  <span style={styles.customChipRemove}>
                    <XIcon size={12} />
                  </span>
                </div>
              ))}
          </div>
          <div style={styles.customIssueRow}>
            <Input
              placeholder="Custom specialization..."
              value={customSpec}
              onChange={(e) => setCustomSpec(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomSpecialization();
                }
              }}
              style={{ flex: 1 }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addCustomSpecialization}
              disabled={!customSpec.trim()}
              style={{ flexShrink: 0 }}
            >
              <PlusIcon
                size={16}
                style={{ marginRight: "0.25rem" }}
              />
              Add
            </Button>
          </div>
        </div>

        {submitError && (
          <div style={{ ...styles.errorBanner, marginTop: "1rem" }}>
            {submitError}
          </div>
        )}
        </div>
      </ModalBody>

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
          {isEdit ? "Update Technician" : "Save Technician"}
        </Button>
      </ModalFooter>
    </>
  );
};

const AddTechnicianModal: React.FC<AddTechnicianModalProps> = (props) => {
  const {
    isOpen,
    onClose,
    onSuccess,
    specializations,
    onSpecializationAdded,
    mode = "standalone",
    technicianToEdit,
  } = props;

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()} nested={mode === "nested"}>
      <ModalContent style={{ maxWidth: "32rem", padding: 0 }}>
        {isOpen && (
          <AddTechnicianForm
            onClose={onClose}
            onSuccess={onSuccess}
            specializations={specializations}
            onSpecializationAdded={onSpecializationAdded}
            technicianToEdit={technicianToEdit}
          />
        )}
      </ModalContent>
    </Modal>
  );
};

export default AddTechnicianModal;
