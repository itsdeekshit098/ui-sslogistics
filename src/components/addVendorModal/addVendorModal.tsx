"use client";

import React, { useState, useCallback } from "react";
import { SaveIcon } from "@/components/ui/icon";
import type { AddVendorModalProps } from "./addVendorModal.types";
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
import * as styles from "./addVendorModal.style";

const PHONE_REGEX = /^[6-9]\d{9}$/;

const AddVendorForm: React.FC<{
  onClose: () => void;
  onSuccess: AddVendorModalProps["onSuccess"];
}> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    location: "",
  });

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setFieldErrors((prev) => ({ ...prev, [id]: "" }));
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Vendor name is required";
    }

    if (formData.phone.trim() && !PHONE_REGEX.test(formData.phone.trim())) {
      errors.phone = "Invalid phone (10 digits starting with 6-9)";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: formData.phone.trim() || undefined,
          location: formData.location.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess(data.data.vendor);
        onClose();
      } else {
        setSubmitError(data.error || "Failed to create vendor");
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
        <ModalTitle>Add New Vendor</ModalTitle>
        <ModalDescription>
          Add a vendor/supplier for spare parts.
        </ModalDescription>
      </ModalHeader>

      <ModalBody style={{ padding: "1.5rem" }}>
        <div style={styles.formSection}>
          <div style={styles.fieldGroup}>
            <Label htmlFor="name">
              Vendor Name <span style={styles.requiredStar}>*</span>
            </Label>
            <Input disabled={loading}
              id="name"
              placeholder="e.g. AutoParts India"
              value={formData.name}
              onChange={handleChange}
              style={fieldErrors.name ? { borderColor: "#ef4444" } : undefined}
            />
            {fieldErrors.name && (
              <span style={styles.fieldError}>{fieldErrors.name}</span>
            )}
          </div>

          <div style={styles.fieldGroup}>
            <Label htmlFor="phone">Phone</Label>
            <Input disabled={loading}
              id="phone"
              placeholder="e.g. 9876543210"
              value={formData.phone}
              onChange={handleChange}
              maxLength={10}
              style={fieldErrors.phone ? { borderColor: "#ef4444" } : undefined}
            />
            {fieldErrors.phone && (
              <span style={styles.fieldError}>{fieldErrors.phone}</span>
            )}
          </div>

          <div style={styles.fieldGroup}>
            <Label htmlFor="location">Location</Label>
            <Input disabled={loading}
              id="location"
              placeholder="e.g. Chennai"
              value={formData.location}
              onChange={handleChange}
            />
          </div>
        </div>

        {submitError && (
          <div style={{ ...styles.errorBanner, marginTop: "1rem" }}>
            {submitError}
          </div>
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
          {loading ? "Adding..." : "Add Vendor"}
        </Button>
      </ModalFooter>
    </>
  );
};

const AddVendorModal: React.FC<AddVendorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent style={{ maxWidth: "28rem", padding: 0 }}>
        {isOpen && <AddVendorForm onClose={onClose} onSuccess={onSuccess} />}
      </ModalContent>
    </Modal>
  );
};

export { AddVendorModal };
