"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SaveIcon, PlusIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LookupSelect } from "@/components/lookupSelect";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { SegmentedControl } from "@/components/ui/segmentedControl";
import { Typeahead, typeaheadFooterActionClassName } from "@/components/typeahead";
import { EntityModal } from "@/components/entityModal";
import { BankAccountModal } from "@/components/bankAccountModal";
import type { Entity } from "@/components/entitiesPage/entitiesPage.types";
import { formatBankAccountLabel, type BankAccount } from "@/components/bankAccountsPage/bankAccountsPage.types";
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
  CLIENT_NOTES_MAX_LENGTH,
  PARTY_KINDS,
  type Client,
  type PartyKind,
} from "@/components/clientsPage/clientsPage.types";
import { todayString } from "@/lib/format";
import type { ClientModalProps } from "./clientModal.types";
import * as styles from "./clientModal.style";

const ClientForm: React.FC<{
  clientToEdit?: Client | null;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ clientToEdit, onClose, onSuccess }) => {
  const isEdit = !!clientToEdit;

  const [partyKind, setPartyKind] = useState<PartyKind>(clientToEdit?.party_kind ?? "COMPANY");
  const [name, setName] = useState(clientToEdit?.name ?? "");
  const [entityId, setEntityId] = useState(
    clientToEdit?.entity_id ? String(clientToEdit.entity_id) : "",
  );
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [receivingAccountId, setReceivingAccountId] = useState(
    clientToEdit?.receiving_account_id ? String(clientToEdit.receiving_account_id) : "",
  );
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [showAddBankAccount, setShowAddBankAccount] = useState(false);
  const [clientType, setClientType] = useState(clientToEdit?.client_type ?? "VENDOR");
  const [location, setLocation] = useState(clientToEdit?.location ?? "");
  const [address, setAddress] = useState(clientToEdit?.address ?? "");
  const [gstNumber, setGstNumber] = useState(clientToEdit?.gst_number ?? "");
  const [notes, setNotes] = useState(clientToEdit?.notes ?? "");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingDate, setOpeningDate] = useState(todayString());

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isIndividual = partyKind === "INDIVIDUAL";

  useEffect(() => {
    if (!isIndividual || entities.length > 0) return;
    setEntitiesLoading(true);
    fetch("/api/entities?is_active=true")
      .then((res) => res.json())
      .then((payload) => setEntities(payload.data?.data ?? []))
      .finally(() => setEntitiesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIndividual]);

  useEffect(() => {
    // Both party kinds can pay into one of our accounts, so this loads
    // unconditionally rather than gating on isIndividual like the entity list.
    setBankAccountsLoading(true);
    fetch("/api/bank-accounts?is_active=true")
      .then((res) => res.json())
      .then((payload) => setBankAccounts(payload.data?.data ?? []))
      .finally(() => setBankAccountsLoading(false));
  }, []);

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (isIndividual) {
      if (!entityId) errors.entityId = "Select who this is";
    } else if (!name.trim()) {
      errors.name = "Company name is required";
    }
    if (openingBalance && Number(openingBalance) <= 0) {
      errors.openingBalance = "Opening balance must be greater than zero";
    }
    if (notes.length > CLIENT_NOTES_MAX_LENGTH) {
      errors.notes = `Notes must be ${CLIENT_NOTES_MAX_LENGTH} characters or less`;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    const payload: Record<string, unknown> = {
      party_kind: partyKind,
      // The name of an INDIVIDUAL client is mirrored from the linked entity
      // server-side (trg_clients_name_mirror) — omitted here so it can never
      // fight the trigger.
      ...(isIndividual ? {} : { name: name.trim() }),
      entity_id: isIndividual ? Number(entityId) : null,
      receiving_account_id: receivingAccountId ? Number(receivingAccountId) : null,
      client_type: clientType,
      location: location.trim() || null,
      address: address.trim() || null,
      gst_number: isIndividual ? null : gstNumber.trim() || null,
      notes: notes.trim() || null,
    };

    if (isEdit) {
      payload.id = clientToEdit!.id;
    } else if (openingBalance) {
      // A client carried over from paper usually already owes something; it
      // becomes the first ledger entry rather than a separate field.
      payload.opening_balance = Number(openingBalance);
      payload.opening_date = openingDate;
    }

    try {
      const response = await fetch("/api/clients", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        setSubmitError(data.error || "Failed to save client");
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
        <ModalTitle>{isEdit ? "Edit Client" : "New Client"}</ModalTitle>
        <ModalDescription>
          {isIndividual
            ? "A person who owes us money — overdue rent, or a plain advance. Bills and payments are recorded on their statement from here on."
            : "A company we supply vehicles to. Bills and payments are recorded on their statement from here on."}
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div style={styles.formGrid}>
          {!isEdit && (
            <div style={styles.fieldGroupFull}>
              <Label>Who is this?</Label>
              <SegmentedControl
                idPrefix="client-party-kind"
                items={PARTY_KINDS.map((k) => ({ key: k.value, label: k.label }))}
                value={partyKind}
                onValueChange={(key) => setPartyKind(key as PartyKind)}
              />
            </div>
          )}

          {isIndividual ? (
            <div style={styles.fieldGroupFull}>
              <Label htmlFor="client-entity">
                Person <span style={styles.requiredStar}>*</span>
              </Label>
              <Typeahead<Entity>
                id="client-entity"
                options={entities}
                value={entityId}
                onValueChange={(val) => {
                  setEntityId(val);
                  setFieldErrors((p) => ({ ...p, entityId: "" }));
                }}
                getOptionLabel={(e) => e.name}
                getOptionValue={(e) => String(e.id)}
                getOptionDescription={(e) => (e.entity_kind === "FIRM" ? "Firm" : "Person")}
                placeholder={entitiesLoading ? "Loading…" : "Search firms and people..."}
                emptyMessage="No entities found."
                disabled={loading || entitiesLoading}
                invalid={!!fieldErrors.entityId}
                footer={
                  <Button
                    variant="ghost"
                    className={typeaheadFooterActionClassName}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setShowAddEntity(true)}
                  >
                    <PlusIcon size={16} />
                    Add new firm or person
                  </Button>
                }
              />
              {fieldErrors.entityId && (
                <span style={styles.fieldError}>{fieldErrors.entityId}</span>
              )}
            </div>
          ) : (
            <div style={styles.fieldGroupFull}>
              <Label htmlFor="client-name">
                Company Name <span style={styles.requiredStar}>*</span>
              </Label>
              <Input
                id="client-name"
                autoFocus
                disabled={loading}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFieldErrors((p) => ({ ...p, name: "" }));
                }}
                style={fieldErrors.name ? { borderColor: "var(--destructive)" } : undefined}
              />
              {fieldErrors.name && (
                <span style={styles.fieldError}>{fieldErrors.name}</span>
              )}
            </div>
          )}

          <div style={styles.fieldGroup}>
            <Label htmlFor="client-type">Type</Label>
            <LookupSelect
              id="client-type"
              category="client_type"
              addLabel="client type"
              placeholder="Select type"
              value={clientType}
              onValueChange={setClientType}
              disabled={loading}
            />
          </div>

          <div style={styles.fieldGroup}>
            <Label htmlFor="client-location">Location</Label>
            <Input
              id="client-location"
              disabled={loading}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div style={styles.fieldGroupFull}>
            <Label htmlFor="client-address">Address</Label>
            <Input
              id="client-address"
              disabled={loading}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {!isIndividual && (
            <div style={styles.fieldGroup}>
              <Label htmlFor="client-gst">GST Number</Label>
              <Input
                id="client-gst"
                disabled={loading}
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              />
            </div>
          )}

          <div style={styles.fieldGroupFull}>
            <Label htmlFor="client-receiving-account">Pays into</Label>
            <Typeahead<BankAccount>
              id="client-receiving-account"
              options={bankAccounts}
              value={receivingAccountId}
              onValueChange={setReceivingAccountId}
              getOptionLabel={(a) => formatBankAccountLabel(a, a.entities?.name)}
              getOptionValue={(a) => String(a.id)}
              getOptionDescription={(a) => [a.ifsc, a.branch].filter(Boolean).join(" · ")}
              placeholder={bankAccountsLoading ? "Loading…" : "Which account do they pay into?"}
              emptyMessage="No bank accounts found."
              disabled={loading || bankAccountsLoading}
              clearable
              footer={
                <Button
                  variant="ghost"
                  className={typeaheadFooterActionClassName}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setShowAddBankAccount(true)}
                >
                  <PlusIcon size={16} />
                  Add new account
                </Button>
              }
            />
          </div>

          {!isEdit && (
            <>
              <div style={styles.fieldGroup}>
                <Label htmlFor="client-opening">Opening Balance (₹)</Label>
                <Input
                  id="client-opening"
                  type="number"
                  disabled={loading}
                  placeholder="What they already owe"
                  value={openingBalance}
                  onChange={(e) => {
                    setOpeningBalance(e.target.value);
                    setFieldErrors((p) => ({ ...p, openingBalance: "" }));
                  }}
                  style={
                    fieldErrors.openingBalance
                      ? { borderColor: "var(--destructive)" }
                      : undefined
                  }
                />
                {fieldErrors.openingBalance && (
                  <span style={styles.fieldError}>{fieldErrors.openingBalance}</span>
                )}
              </div>

              {openingBalance && (
                <div style={styles.fieldGroup}>
                  <Label htmlFor="client-opening-date">As Of</Label>
                  <Input
                    id="client-opening-date"
                    type="date"
                    disabled={loading}
                    value={openingDate}
                    onChange={(e) => setOpeningDate(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          <div style={styles.fieldGroupFull}>
            <Label htmlFor="client-notes">Notes</Label>
            <Textarea
              id="client-notes"
              rows={3}
              disabled={loading}
              maxLength={CLIENT_NOTES_MAX_LENGTH}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <span style={styles.charCount}>
              {notes.length}/{CLIENT_NOTES_MAX_LENGTH}
            </span>
          </div>
        </div>

        {submitError && <div style={styles.errorBanner}>{submitError}</div>}
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
          {loading ? "Saving..." : isEdit ? "Update Client" : "Save Client"}
        </Button>
      </ModalFooter>

      <EntityModal
        nested
        isOpen={showAddEntity}
        onClose={() => setShowAddEntity(false)}
        onSuccess={(entity) => {
          setEntities((prev) => [...prev, entity]);
          setEntityId(String(entity.id));
          setFieldErrors((p) => ({ ...p, entityId: "" }));
        }}
      />

      <BankAccountModal
        nested
        isOpen={showAddBankAccount}
        onClose={() => setShowAddBankAccount(false)}
        onSuccess={(account) => {
          setBankAccounts((prev) => [...prev, account]);
          setReceivingAccountId(String(account.id));
        }}
      />
    </>
  );
};

const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  clientToEdit,
  onClose,
  onSuccess,
  mode = "standalone",
}) => (
  <Modal
    open={isOpen}
    onOpenChange={(open) => !open && onClose()}
    nested={mode === "nested"}
  >
    <ModalContent style={{ maxWidth: "42rem", padding: 0 }}>
      {isOpen && (
        <ClientForm
          clientToEdit={clientToEdit}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </ModalContent>
  </Modal>
);

export { ClientModal };
export default ClientModal;
