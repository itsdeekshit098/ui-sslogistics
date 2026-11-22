"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SaveIcon, PlusIcon } from "@ui/icons";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import { FormField } from "@ui/components/formField";
import { FormGrid } from "@ui/components/formGrid";
import { Alert } from "@ui/components/alert";
import { DatePicker } from "@ui/components/datePicker";
import { MoneyInput } from "@ui/components/moneyInput";
import { Textarea } from "@ui/components/textarea";
import { Switch } from "@ui/components/switch";
import { LookupSelect } from "@/components/lookupSelect";
import { Spinner } from "@ui/components/spinner";
import { SegmentedControl } from "@ui/components/segmentedControl";
import { Combobox, ComboboxFooterAction } from "@ui/components/combobox";
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
} from "@ui/components/modal";
import {
  CLIENT_NOTES_MAX_LENGTH,
  PARTY_KINDS,
  type Client,
  type PartyKind,
} from "@/components/clientsPage/clientsPage.types";
import { todayInIndia } from "@/lib/dateOnly";
import type { ClientModalProps } from "./clientModal.types";

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
  const [isActive, setIsActive] = useState(clientToEdit?.is_active ?? true);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  // The business day in India: the UTC date is still "yesterday" until 05:30.
  const today = todayInIndia();
  const [openingDate, setOpeningDate] = useState<string | null>(today);

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
    if (openingBalance != null && openingBalance <= 0) {
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
      payload.is_active = isActive;
    } else if (openingBalance != null) {
      // A client carried over from paper usually already owes something; it
      // becomes the first ledger entry rather than a separate field.
      payload.opening_balance = openingBalance;
      payload.opening_date = openingDate ?? today;
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
        <FormGrid className="mt-2">
          {!isEdit && (
            <div className="flex flex-col gap-2 sm:col-span-2">
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
            <FormField
              className="sm:col-span-2"
              label="Person"
              required
              htmlFor="client-entity"
              error={fieldErrors.entityId}
            >
              <Combobox<Entity>
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
                  <ComboboxFooterAction
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setShowAddEntity(true)}
                  >
                    <PlusIcon size={16} />
                    Add new firm or person
                  </ComboboxFooterAction>
                }
              />
            </FormField>
          ) : (
            <FormField
              className="sm:col-span-2"
              label="Company Name"
              required
              error={fieldErrors.name}
            >
              {(control) => (
                <Input
                  {...control}
                  autoFocus
                  disabled={loading}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldErrors((p) => ({ ...p, name: "" }));
                  }}
                />
              )}
            </FormField>
          )}

          <FormField label="Type" htmlFor="client-type">
            <LookupSelect
              id="client-type"
              category="client_type"
              addLabel="client type"
              placeholder="Select type"
              value={clientType}
              onValueChange={setClientType}
              disabled={loading}
            />
          </FormField>

          <FormField label="Location">
            {(control) => (
              <Input
                {...control}
                disabled={loading}
                maxLength={150}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            )}
          </FormField>

          <FormField className="sm:col-span-2" label="Address">
            {(control) => (
              <Input
                {...control}
                disabled={loading}
                maxLength={500}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            )}
          </FormField>

          {!isIndividual && (
            <FormField label="GST Number">
              {(control) => (
                <Input
                  {...control}
                  disabled={loading}
                  maxLength={20}
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                />
              )}
            </FormField>
          )}

          <FormField className="sm:col-span-2" label="Pays into" htmlFor="client-receiving-account">
            <Combobox<BankAccount>
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
                <ComboboxFooterAction
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setShowAddBankAccount(true)}
                >
                  <PlusIcon size={16} />
                  Add new account
                </ComboboxFooterAction>
              }
            />
          </FormField>

          {isEdit && (
            <FormField
              className="sm:col-span-2"
              label="Active"
              hint="An inactive client keeps its statement but no bills or payments can be added until it is made active again."
            >
              {(control) => (
                <Switch
                  id={control.id}
                  aria-describedby={control["aria-describedby"]}
                  aria-label="Active"
                  disabled={loading}
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              )}
            </FormField>
          )}

          {!isEdit && (
            <>
              <FormField label="Opening Balance (₹)" error={fieldErrors.openingBalance}>
                {(control) => (
                  <MoneyInput
                    {...control}
                    disabled={loading}
                    min={0}
                    placeholder="What they already owe"
                    value={openingBalance}
                    onValueChange={(v) => {
                      setOpeningBalance(v);
                      setFieldErrors((p) => ({ ...p, openingBalance: "" }));
                    }}
                  />
                )}
              </FormField>

              {openingBalance != null && (
                <FormField label="As Of">
                  {(control) => (
                    <DatePicker
                      {...control}
                      today={today}
                      disabled={loading}
                      value={openingDate}
                      onValueChange={setOpeningDate}
                    />
                  )}
                </FormField>
              )}
            </>
          )}

          <FormField className="sm:col-span-2" label="Notes" error={fieldErrors.notes}>
            {(control) => (
              <>
                <Textarea
                  {...control}
                  rows={3}
                  disabled={loading}
                  maxLength={CLIENT_NOTES_MAX_LENGTH}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <span className="self-end text-xs text-muted-foreground">
                  {notes.length}/{CLIENT_NOTES_MAX_LENGTH}
                </span>
              </>
            )}
          </FormField>
        </FormGrid>

        {submitError && (
          <Alert tone="danger" className="mt-4" scrollIntoView>
            {submitError}
          </Alert>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <Spinner size="sm" className="mr-2" />
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
