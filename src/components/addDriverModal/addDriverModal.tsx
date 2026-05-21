"use client";

import React, { useState, useEffect, useCallback } from "react";
import { XIcon, SaveIcon } from "@/components/ui/icon";
import type { AddDriverModalProps } from "./addDriverModal.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/loadingSpinner";
import * as styles from "./addDriverModal.style";

const PHONE_REGEX = /^[6-9]\d{9}$/;

const AddDriverForm: React.FC<{
  onClose: () => void;
  onSuccess: AddDriverModalProps["onSuccess"];
  driverToEdit?: AddDriverModalProps["driverToEdit"];
}> = ({ onClose, onSuccess, driverToEdit }) => {
  const isEdit = !!driverToEdit;

  const [formData, setFormData] = useState({
    name: driverToEdit?.name || "",
    phone: driverToEdit?.phone || "",
    place: driverToEdit?.place || "",
    dl_number: driverToEdit?.dl_number || "",
    photo_url: driverToEdit?.photo_url || "",
  });

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      if (isEdit && driverToEdit) {
        res = await fetch("/api/drivers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: driverToEdit.id,
            name: formData.name.trim(),
            phone: formData.phone.trim() || undefined,
            place: formData.place.trim() || undefined,
            dl_number: formData.dl_number.trim() || undefined,
            photo_url: formData.photo_url.trim() || undefined,
          }),
        });
      } else {
        res = await fetch("/api/drivers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            phone: formData.phone.trim() || undefined,
            place: formData.place.trim() || undefined,
            dl_number: formData.dl_number.trim() || undefined,
            photo_url: formData.photo_url.trim() || undefined,
          }),
        });
      }

      const data = await res.json();

      if (res.ok) {
        onSuccess(data.data.driver);
        setLoading(false);
        onClose();
      } else {
        setSubmitError(data.error || "Failed to save driver");
        setLoading(false);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <button
          style={styles.closeButton}
          onClick={handleClose}
          disabled={loading}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = "0.7";
          }}
        >
          <XIcon size={16} />
        </button>

        <div style={styles.scrollArea} className="scrollbar-custom">
          <div>
            <h2 style={styles.headerTitle}>
              {isEdit ? "Edit Driver" : "Add New Driver"}
            </h2>
            <p style={styles.headerDescription}>
              {isEdit
                ? "Update driver details."
                : "Create a new driver profile."}
            </p>
          </div>

          <div style={styles.formSection}>
            {/* Name */}
            <div style={styles.fieldGroup}>
              <Label htmlFor="name">
                Name <span style={styles.requiredStar}>*</span>
              </Label>
              <Input
                id="name"
                placeholder="Driver name"
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

            {/* Phone */}
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

            {/* Place */}
            <div style={styles.fieldGroup}>
              <Label htmlFor="place">Place / Address</Label>
              <Input
                id="place"
                placeholder="City or area"
                value={formData.place}
                onChange={handleChange}
              />
            </div>

            {/* DL Number */}
            <div style={styles.fieldGroup}>
              <Label htmlFor="dl_number">DL Number</Label>
              <Input
                id="dl_number"
                placeholder="Driving licence number"
                value={formData.dl_number}
                onChange={handleChange}
              />
            </div>

            {/* Photo URL */}
            <div style={styles.fieldGroup}>
              <Label htmlFor="photo_url">Photo URL</Label>
              <Input
                id="photo_url"
                placeholder="Paste a photo link"
                value={formData.photo_url}
                onChange={handleChange}
              />
            </div>
          </div>

          {submitError && (
            <div style={{ ...styles.errorBanner, marginTop: "1rem" }}>
              {submitError}
            </div>
          )}

          <div style={styles.footer}>
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
              {isEdit ? "Update Driver" : "Save Driver"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Wrapper — conditionally mounts/unmounts form for state reset ───

const AddDriverModal: React.FC<AddDriverModalProps> = (props) => {
  const {
    isOpen,
    onClose,
    onSuccess,
    mode = "standalone",
    driverToEdit,
  } = props;

  if (!isOpen) return null;

  return (
    <div style={{ position: "relative", zIndex: mode === "nested" ? 60 : 50 }}>
      <AddDriverForm
        onClose={onClose}
        onSuccess={onSuccess}
        driverToEdit={driverToEdit}
      />
    </div>
  );
};

export default AddDriverModal;
