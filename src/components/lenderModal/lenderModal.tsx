"use client";

import React, { useCallback, useState } from "react";
import { SaveIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/loadingSpinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import type { Lender } from "@/components/loansPage/loansPage.types";
import type { LenderModalProps } from "./lenderModal.types";

const LENDER_KINDS = [
  { value: "INSTITUTION", label: "Bank / Finance company" },
  { value: "PRIVATE", label: "Private individual" },
] as const;

const LenderForm: React.FC<{
  defaultKind: "INSTITUTION" | "PRIVATE";
  lenderToEdit?: Lender | null;
  onClose: () => void;
  onSuccess: (lender: Lender) => void;
}> = ({ defaultKind, lenderToEdit, onClose, onSuccess }) => {
  const isEdit = !!lenderToEdit;

  const [name, setName] = useState(lenderToEdit?.name ?? "");
  const [lenderKind, setLenderKind] = useState<string>(
    lenderToEdit?.lender_kind ?? defaultKind,
  );
  const [phone, setPhone] = useState(lenderToEdit?.phone ?? "");
  const [contactPerson, setContactPerson] = useState(
    lenderToEdit?.contact_person ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Name is required";
    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) {
      errors.phone = "Enter a valid 10-digit mobile number";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      lender_kind: lenderKind,
      phone: phone.trim() || null,
      contact_person: contactPerson.trim() || null,
    };
    if (isEdit) payload.id = lenderToEdit!.id;

    try {
      const response = await fetch("/api/lenders", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        onSuccess(data.data.lender);
        onClose();
      } else {
        setSubmitError(data.error || "Failed to save lender");
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
        <ModalTitle>{isEdit ? "Edit Lender" : "Add Lender"}</ModalTitle>
        <ModalDescription>
          A finance company for EMI loans, or a private individual who lends at
          an agreed rate. Both live in one list, so the same party used either
          way isn&rsquo;t entered twice.
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lender-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lender-name"
              autoFocus
              disabled={loading}
              placeholder="e.g. Shriram Finance"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, name: "" }));
              }}
              className={fieldErrors.name ? "border-destructive" : ""}
            />
            {fieldErrors.name && (
              <span className="text-xs text-destructive">{fieldErrors.name}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lender-kind">Type</Label>
            <Select
              disabled={loading}
              value={lenderKind}
              onValueChange={setLenderKind}
            >
              <SelectTrigger id="lender-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LENDER_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lender-phone">Phone</Label>
            <Input
              id="lender-phone"
              inputMode="numeric"
              disabled={loading}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setFieldErrors((prev) => ({ ...prev, phone: "" }));
              }}
              className={fieldErrors.phone ? "border-destructive" : ""}
            />
            {fieldErrors.phone && (
              <span className="text-xs text-destructive">{fieldErrors.phone}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lender-contact">Contact Person</Label>
            <Input
              id="lender-contact"
              disabled={loading}
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
            />
          </div>
        </div>

        {submitError && (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
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
          {loading ? "Saving..." : isEdit ? "Update" : "Add"}
        </Button>
      </ModalFooter>
    </>
  );
};

const LenderModal: React.FC<LenderModalProps> = ({
  isOpen,
  defaultKind = "INSTITUTION",
  lenderToEdit,
  onClose,
  onSuccess,
  nested = false,
}) => (
  <Modal nested={nested} open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <ModalContent style={{ maxWidth: "28rem", padding: 0 }}>
      {isOpen && (
        <LenderForm
          defaultKind={defaultKind}
          lenderToEdit={lenderToEdit}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </ModalContent>
  </Modal>
);

export { LenderModal };
export default LenderModal;
