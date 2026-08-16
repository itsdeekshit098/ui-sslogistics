"use client";

import React, { useState } from "react";
import { SaveIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LookupSelect } from "@/components/lookupSelect";
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
import type { ClientContact } from "@/components/clientsPage/clientsPage.types";

export interface ContactModalProps {
  isOpen: boolean;
  clientId: number;
  contactToEdit?: ClientContact | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ContactForm: React.FC<Omit<ContactModalProps, "isOpen">> = ({
  clientId,
  contactToEdit,
  onClose,
  onSuccess,
}) => {
  const isEdit = !!contactToEdit;

  const [name, setName] = useState(contactToEdit?.name ?? "");
  const [role, setRole] = useState(contactToEdit?.role ?? "");
  const [designation, setDesignation] = useState(contactToEdit?.designation ?? "");
  const [phone, setPhone] = useState(contactToEdit?.phone ?? "");
  const [altPhone, setAltPhone] = useState(contactToEdit?.alt_phone ?? "");
  const [email, setEmail] = useState(contactToEdit?.email ?? "");
  const [isPrimary, setIsPrimary] = useState(contactToEdit?.is_primary ?? false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Name is required";
    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) {
      errors.phone = "Enter a valid 10-digit mobile number";
    }
    if (altPhone.trim() && !/^[6-9]\d{9}$/.test(altPhone.trim())) {
      errors.altPhone = "Enter a valid 10-digit mobile number";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      role: role || null,
      designation: designation.trim() || null,
      phone: phone.trim() || null,
      alt_phone: altPhone.trim() || null,
      email: email.trim() || null,
      is_primary: isPrimary,
    };
    if (isEdit) payload.id = contactToEdit!.id;

    try {
      const res = await fetch(`/api/clients/${clientId}/contacts`, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(json.error || "Failed to save contact");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ModalHeader>
        <ModalTitle>{isEdit ? "Edit Contact" : "Add Contact"}</ModalTitle>
        <ModalDescription>
          Someone at this company worth having a number for — HR for the
          contract, operations for the vehicles, accounts for the money.
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="contact-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact-name"
              autoFocus
              disabled={loading}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((p) => ({ ...p, name: "" }));
              }}
              className={fieldErrors.name ? "border-destructive" : ""}
            />
            {fieldErrors.name && (
              <span className="text-xs text-destructive">{fieldErrors.name}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-role">Role</Label>
            <LookupSelect
              id="contact-role"
              category="contact_role"
              addLabel="contact role"
              placeholder="Select role"
              value={role}
              onValueChange={setRole}
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-designation">Designation</Label>
            <Input
              id="contact-designation"
              disabled={loading}
              placeholder="e.g. Senior Manager"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-phone">Phone</Label>
            <Input
              id="contact-phone"
              inputMode="numeric"
              disabled={loading}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setFieldErrors((p) => ({ ...p, phone: "" }));
              }}
              className={fieldErrors.phone ? "border-destructive" : ""}
            />
            {fieldErrors.phone && (
              <span className="text-xs text-destructive">{fieldErrors.phone}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-alt-phone">Alternate Phone</Label>
            <Input
              id="contact-alt-phone"
              inputMode="numeric"
              disabled={loading}
              value={altPhone}
              onChange={(e) => {
                setAltPhone(e.target.value);
                setFieldErrors((p) => ({ ...p, altPhone: "" }));
              }}
              className={fieldErrors.altPhone ? "border-destructive" : ""}
            />
            {fieldErrors.altPhone && (
              <span className="text-xs text-destructive">{fieldErrors.altPhone}</span>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--primary)]"
              disabled={loading}
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            <span className="text-sm">
              Primary contact
              <span className="ml-1 text-muted-foreground">
                — replaces whoever is currently marked primary
              </span>
            </span>
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
          )}
          {loading ? "Saving..." : isEdit ? "Update" : "Add"}
        </Button>
      </ModalFooter>
    </>
  );
};

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, ...rest }) => (
  <Modal open={isOpen} onOpenChange={(open) => !open && rest.onClose()}>
    <ModalContent style={{ maxWidth: "34rem", padding: 0 }}>
      {isOpen && <ContactForm {...rest} />}
    </ModalContent>
  </Modal>
);

export default ContactModal;
