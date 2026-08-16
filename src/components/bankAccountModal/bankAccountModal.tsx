"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SaveIcon, PlusIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Typeahead, typeaheadFooterActionClassName } from "@/components/typeahead";
import { LookupSelect } from "@/components/lookupSelect";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { EntityModal } from "@/components/entityModal";
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
import type { Entity } from "@/components/entitiesPage/entitiesPage.types";
import {
  ACCOUNT_TYPES,
  BANK_ACCOUNT_NOTES_MAX_LENGTH,
  type AccountType,
  type BankAccount,
} from "@/components/bankAccountsPage/bankAccountsPage.types";
import type { BankAccountModalProps } from "./bankAccountModal.types";

interface FormState {
  holderEntityId: string;
  bankName: string;
  accountNumber: string;
  accountType: AccountType;
  ifsc: string;
  branch: string;
  nickname: string;
  notes: string;
}

function initialState(account?: BankAccount | null): FormState {
  return {
    holderEntityId: account ? String(account.holder_entity_id) : "",
    bankName: account?.bank_name ?? "",
    accountNumber: account?.account_number ?? "",
    accountType: account?.account_type ?? "SAVINGS",
    ifsc: account?.ifsc ?? "",
    branch: account?.branch ?? "",
    nickname: account?.nickname ?? "",
    notes: account?.notes ?? "",
  };
}

const BankAccountForm: React.FC<{
  accountToEdit?: BankAccount | null;
  onClose: () => void;
  onSuccess: (account: BankAccount) => void;
}> = ({ accountToEdit, onClose, onSuccess }) => {
  const isEdit = !!accountToEdit;

  const [form, setForm] = useState<FormState>(() => initialState(accountToEdit));
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showAddEntity, setShowAddEntity] = useState(false);

  const loadEntities = useCallback(async () => {
    setEntitiesLoading(true);
    try {
      const res = await fetch("/api/entities?is_active=true");
      const payload = await res.json();
      if (res.ok) setEntities(payload.data?.data ?? []);
    } finally {
      setEntitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

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
    if (!form.holderEntityId) errors.holderEntityId = "Holder is required";
    if (!form.bankName) errors.bankName = "Bank is required";
    if (!/^[0-9]{6,20}$/.test(form.accountNumber.trim())) {
      errors.accountNumber = "Enter a valid account number (6-20 digits)";
    }
    if (form.ifsc.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.trim().toUpperCase())) {
      errors.ifsc = "Enter a valid IFSC code";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    const payload: Record<string, unknown> = {
      holder_entity_id: Number(form.holderEntityId),
      bank_name: form.bankName,
      account_number: form.accountNumber.trim(),
      account_type: form.accountType,
      ifsc: form.ifsc.trim() ? form.ifsc.trim().toUpperCase() : null,
      branch: form.branch.trim() || null,
      nickname: form.nickname.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (isEdit) payload.id = accountToEdit!.id;

    try {
      const response = await fetch("/api/bank-accounts", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        onSuccess(data.data.bank_account);
        onClose();
      } else {
        setSubmitError(data.error || "Failed to save bank account");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const errorClass = (key: string) => (fieldErrors[key] ? "border-destructive" : "");
  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name] ? (
      <span className="text-xs text-destructive">{fieldErrors[name]}</span>
    ) : null;

  return (
    <>
      <ModalHeader>
        <ModalTitle>{isEdit ? "Edit Bank Account" : "Add Bank Account"}</ModalTitle>
        <ModalDescription>
          One of our own accounts — used to record which account a loan&rsquo;s
          EMI mandate debits from. Not a lender, and not tied to any payment.
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="bank-account-holder">
              Held By <span className="text-destructive">*</span>
            </Label>
            <Typeahead<Entity>
              id="bank-account-holder"
              options={entities}
              value={form.holderEntityId}
              onValueChange={(val) => setField("holderEntityId", val)}
              getOptionLabel={(e) => e.name}
              getOptionValue={(e) => String(e.id)}
              getOptionDescription={(e) => (e.entity_kind === "FIRM" ? "Firm" : "Person")}
              placeholder={entitiesLoading ? "Loading…" : "Search firms and people..."}
              emptyMessage="No entities found."
              disabled={loading || entitiesLoading}
              invalid={!!fieldErrors.holderEntityId}
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
            <FieldError name="holderEntityId" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-account-bank">
              Bank <span className="text-destructive">*</span>
            </Label>
            <LookupSelect
              id="bank-account-bank"
              category="bank_name"
              addLabel="bank"
              placeholder="Select bank"
              value={form.bankName}
              onValueChange={(val) => setField("bankName", val)}
              disabled={loading}
              invalid={!!fieldErrors.bankName}
            />
            <FieldError name="bankName" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-account-type">Account Type</Label>
            <Select
              disabled={loading}
              value={form.accountType}
              onValueChange={(val) => setField("accountType", val as AccountType)}
            >
              <SelectTrigger id="bank-account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-account-number">
              Account Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bank-account-number"
              inputMode="numeric"
              disabled={loading}
              value={form.accountNumber}
              onChange={(e) => setField("accountNumber", e.target.value)}
              className={errorClass("accountNumber")}
            />
            <FieldError name="accountNumber" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-account-ifsc">IFSC</Label>
            <Input
              id="bank-account-ifsc"
              disabled={loading}
              placeholder="e.g. UTIB0001234"
              value={form.ifsc}
              onChange={(e) => setField("ifsc", e.target.value.toUpperCase())}
              className={errorClass("ifsc")}
            />
            <FieldError name="ifsc" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-account-branch">Branch</Label>
            <Input
              id="bank-account-branch"
              disabled={loading}
              value={form.branch}
              onChange={(e) => setField("branch", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="bank-account-nickname">Nickname</Label>
            <Input
              id="bank-account-nickname"
              disabled={loading}
              placeholder="e.g. Salary account — overrides the derived label when set"
              value={form.nickname}
              onChange={(e) => setField("nickname", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="bank-account-notes">Notes</Label>
            <Textarea
              id="bank-account-notes"
              rows={3}
              disabled={loading}
              maxLength={BANK_ACCOUNT_NOTES_MAX_LENGTH}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
            />
            <span className="self-end text-xs text-muted-foreground">
              {form.notes.length}/{BANK_ACCOUNT_NOTES_MAX_LENGTH}
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
          {loading ? "Saving..." : isEdit ? "Update" : "Add"}
        </Button>
      </ModalFooter>

      <EntityModal
        nested
        isOpen={showAddEntity}
        onClose={() => setShowAddEntity(false)}
        onSuccess={(entity) => {
          setEntities((prev) => [...prev, entity]);
          setField("holderEntityId", String(entity.id));
        }}
      />
    </>
  );
};

const BankAccountModal: React.FC<BankAccountModalProps> = ({
  isOpen,
  accountToEdit,
  onClose,
  onSuccess,
  nested = false,
}) => (
  <Modal nested={nested} open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <ModalContent style={{ maxWidth: "40rem", padding: 0 }}>
      {isOpen && (
        <BankAccountForm
          accountToEdit={accountToEdit}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </ModalContent>
  </Modal>
);

export { BankAccountModal };
export default BankAccountModal;
