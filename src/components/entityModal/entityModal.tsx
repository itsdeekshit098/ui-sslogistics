"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SaveIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Typeahead } from "@/components/typeahead";
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
import {
  ENTITY_KINDS,
  ENTITY_NOTES_MAX_LENGTH,
  RELATIONSHIPS,
  type Entity,
  type EntityKind,
  type EntityRelationship,
} from "@/components/entitiesPage/entitiesPage.types";
import type { EntityModalProps } from "./entityModal.types";

interface FormState {
  name: string;
  entityKind: EntityKind | "";
  relationship: EntityRelationship;
  proprietorEntityId: string;
  phone: string;
  email: string;
  pan: string;
  gstNumber: string;
  address: string;
  notes: string;
}

function initialState(entity?: Entity | null): FormState {
  return {
    name: entity?.name ?? "",
    entityKind: entity?.entity_kind ?? "",
    relationship: entity?.relationship ?? "INTERNAL",
    proprietorEntityId: entity?.proprietor_entity_id
      ? String(entity.proprietor_entity_id)
      : "",
    phone: entity?.phone ?? "",
    email: entity?.email ?? "",
    pan: entity?.pan ?? "",
    gstNumber: entity?.gst_number ?? "",
    address: entity?.address ?? "",
    notes: entity?.notes ?? "",
  };
}

const EntityForm: React.FC<{
  entityToEdit?: Entity | null;
  onClose: () => void;
  onSuccess: (entity: Entity) => void;
}> = ({ entityToEdit, onClose, onSuccess }) => {
  const isEdit = !!entityToEdit;

  const [form, setForm] = useState<FormState>(() => initialState(entityToEdit));
  const [people, setPeople] = useState<Entity[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isFirm = form.entityKind === "FIRM";

  // Only a firm has a proprietor, so the person list is fetched lazily — the
  // moment the user picks "Firm", not on every open.
  useEffect(() => {
    if (!isFirm || people.length > 0) return;

    let cancelled = false;
    setPeopleLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/entities?entity_kind=PERSON&is_active=true");
        const payload = await res.json();
        if (!cancelled && res.ok) {
          setPeople(payload.data?.data ?? []);
        }
      } catch {
        // Leaving the list empty degrades to "no proprietor", which is valid.
      } finally {
        if (!cancelled) setPeopleLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFirm, people.length]);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setFieldErrors((prev) => ({ ...prev, [key]: "" }));
    },
    [],
  );

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors.name = "Name is required";
    }
    if (!form.entityKind) {
      errors.entityKind = "Choose firm or person";
    }
    if (form.phone.trim() && !/^[6-9]\d{9}$/.test(form.phone.trim())) {
      errors.phone = "Enter a valid 10-digit mobile number";
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email address";
    }
    if (form.notes.length > ENTITY_NOTES_MAX_LENGTH) {
      errors.notes = `Notes must be ${ENTITY_NOTES_MAX_LENGTH} characters or less`;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      entity_kind: form.entityKind,
      relationship: form.relationship,
      // A person can never carry a proprietor — clear it rather than send a
      // stale id the API would reject.
      proprietor_entity_id: isFirm ? form.proprietorEntityId || null : null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      pan: form.pan.trim() || null,
      gst_number: form.gstNumber.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (isEdit) payload.id = entityToEdit!.id;

    try {
      const response = await fetch("/api/entities", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess(data.data.entity);
        onClose();
      } else {
        setSubmitError(data.error || "Failed to save");
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
        <ModalTitle>{isEdit ? "Edit Entity" : "New Firm or Person"}</ModalTitle>
        <ModalDescription>
          {isEdit
            ? "Update this firm or person. Renaming it updates every vehicle assigned to it."
            : "Add one of our proprietorships, a family member, or an external party whose vehicles we run."}
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="entity-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="entity-name"
              disabled={loading}
              value={form.name}
              placeholder="e.g. SS LOGISTICS - DEEKSHITH"
              onChange={(e) => setField("name", e.target.value)}
              className={fieldErrors.name ? "border-destructive" : ""}
            />
            {fieldErrors.name && (
              <span className="text-xs text-destructive">{fieldErrors.name}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entity-kind">
              Type <span className="text-destructive">*</span>
            </Label>
            <Select
              disabled={loading}
              value={form.entityKind}
              onValueChange={(val) => setField("entityKind", val as EntityKind)}
            >
              <SelectTrigger
                id="entity-kind"
                className={fieldErrors.entityKind ? "border-destructive" : ""}
              >
                <SelectValue placeholder="Firm or Person" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.entityKind && (
              <span className="text-xs text-destructive">{fieldErrors.entityKind}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entity-relationship">Relationship</Label>
            <Select
              disabled={loading}
              value={form.relationship}
              onValueChange={(val) =>
                setField("relationship", val as EntityRelationship)
              }
            >
              <SelectTrigger id="entity-relationship">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              &ldquo;Ours&rdquo; covers our own firms and family; &ldquo;External&rdquo;
              is a third party.
            </span>
          </div>

          {isFirm && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="entity-proprietor">Proprietor (optional)</Label>
              <Typeahead<Entity>
                id="entity-proprietor"
                options={people.filter((p) => p.id !== entityToEdit?.id)}
                value={form.proprietorEntityId}
                onValueChange={(val) => setField("proprietorEntityId", val)}
                getOptionLabel={(p) => p.name}
                getOptionValue={(p) => String(p.id)}
                placeholder={peopleLoading ? "Loading…" : "Search people..."}
                emptyMessage="No people added yet."
                disabled={loading || peopleLoading}
                clearable
              />
              <span className="text-xs text-muted-foreground">
                The person this proprietorship belongs to.
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="entity-phone">Phone</Label>
            <Input
              id="entity-phone"
              inputMode="numeric"
              disabled={loading}
              value={form.phone}
              placeholder="10-digit mobile"
              onChange={(e) => setField("phone", e.target.value)}
              className={fieldErrors.phone ? "border-destructive" : ""}
            />
            {fieldErrors.phone && (
              <span className="text-xs text-destructive">{fieldErrors.phone}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entity-email">Email</Label>
            <Input
              id="entity-email"
              type="email"
              disabled={loading}
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className={fieldErrors.email ? "border-destructive" : ""}
            />
            {fieldErrors.email && (
              <span className="text-xs text-destructive">{fieldErrors.email}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entity-pan">PAN</Label>
            <Input
              id="entity-pan"
              disabled={loading}
              value={form.pan}
              onChange={(e) => setField("pan", e.target.value.toUpperCase())}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entity-gst">GST Number</Label>
            <Input
              id="entity-gst"
              disabled={loading}
              value={form.gstNumber}
              onChange={(e) => setField("gstNumber", e.target.value.toUpperCase())}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="entity-address">Address</Label>
            <Input
              id="entity-address"
              disabled={loading}
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="entity-notes">Notes</Label>
            <Textarea
              id="entity-notes"
              disabled={loading}
              rows={3}
              maxLength={ENTITY_NOTES_MAX_LENGTH}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              className={fieldErrors.notes ? "border-destructive" : ""}
            />
            <span className="self-end text-xs text-muted-foreground">
              {form.notes.length}/{ENTITY_NOTES_MAX_LENGTH}
            </span>
          </div>
        </div>

        {submitError && (
          <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
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
          {loading ? "Saving..." : isEdit ? "Update" : "Save"}
        </Button>
      </ModalFooter>
    </>
  );
};

const EntityModal: React.FC<EntityModalProps> = ({
  isOpen,
  entityToEdit,
  onClose,
  onSuccess,
  nested = false,
}) => {
  return (
    <Modal nested={nested} open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent style={{ maxWidth: "40rem", padding: 0 }}>
        {/* Mounted only while open so the form state resets between records. */}
        {isOpen && (
          <EntityForm
            entityToEdit={entityToEdit}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        )}
      </ModalContent>
    </Modal>
  );
};

export { EntityModal };
export default EntityModal;
