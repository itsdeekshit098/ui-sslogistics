"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SaveIcon, PlusIcon } from "@ui/icons";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { FormField } from "@ui/components/formField";
import { FormGrid } from "@ui/components/formGrid";
import { Alert } from "@ui/components/alert";
import { DatePicker } from "@ui/components/datePicker";
import { MoneyInput } from "@ui/components/moneyInput";
import { NumberInput } from "@ui/components/numberInput";
import { Textarea } from "@ui/components/textarea";
import { Combobox, ComboboxFooterAction } from "@ui/components/combobox";
import { LookupSelect } from "@/components/lookupSelect";
import { Spinner } from "@ui/components/spinner";
import { EntityModal } from "@/components/entityModal";
import { LenderModal } from "@/components/lenderModal";
import { BankAccountModal } from "@/components/bankAccountModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/select";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@ui/components/modal";
import type { Entity } from "@/components/entitiesPage/entitiesPage.types";
import {
  MANDATE_TYPES,
  formatBankAccountLabel,
  type BankAccount,
  type MandateType,
} from "@/components/bankAccountsPage/bankAccountsPage.types";
import {
  LOAN_NOTES_MAX_LENGTH,
  type Lender,
  type LinkedVehicle,
  type Loan,
} from "@/components/loansPage/loansPage.types";
import { todayInIndia } from "@/lib/dateOnly";
import { applyLoanField } from "./loanModal.utils";
import type { LoanModalProps } from "./loanModal.types";

interface FormState {
  loanType: string;
  borrowerEntityId: string;
  lenderId: string;
  loanNumber: string;
  vehicleId: string;
  collateralDescription: string;
  principalAmount: number | null;
  disbursedAmount: number | null;
  interestRate: number | null;
  processingFee: number | null;
  startDate: string;
  firstEmiDate: string;
  emiAmount: number | null;
  emiDayOfMonth: number | null;
  totalInstallments: number | null;
  outstandingOverride: number | null;
  debitAccountId: string;
  mandateType: MandateType | "";
  notes: string;
}

function initialState(loan?: Loan | null): FormState {
  return {
    loanType: loan?.loan_type ?? "",
    borrowerEntityId: loan ? String(loan.borrower_entity_id) : "",
    lenderId: loan?.lender_id ? String(loan.lender_id) : "",
    loanNumber: loan?.loan_number ?? "",
    vehicleId: loan?.vehicle_id ? String(loan.vehicle_id) : "",
    collateralDescription: loan?.collateral_description ?? "",
    principalAmount: loan ? loan.principal_amount : null,
    disbursedAmount: loan?.disbursed_amount ?? null,
    interestRate: loan?.interest_rate ?? null,
    processingFee: loan?.processing_fee ?? null,
    startDate: loan?.start_date ?? "",
    firstEmiDate: loan?.first_emi_date ?? "",
    emiAmount: loan ? loan.emi_amount : null,
    emiDayOfMonth: loan ? loan.emi_day_of_month : null,
    totalInstallments: loan ? loan.total_installments : null,
    outstandingOverride: loan?.outstanding_override ?? null,
    debitAccountId: loan?.debit_account_id ? String(loan.debit_account_id) : "",
    mandateType: (loan?.mandate_type as MandateType | null) ?? "",
    notes: loan?.notes ?? "",
  };
}

const LoanForm: React.FC<{
  loanToEdit?: Loan | null;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ loanToEdit, onClose, onSuccess }) => {
  const isEdit = !!loanToEdit;

  const [form, setForm] = useState<FormState>(() => initialState(loanToEdit));
  const [entities, setEntities] = useState<Entity[]>([]);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [vehicles, setVehicles] = useState<LinkedVehicle[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [showAddEntity, setShowAddEntity] = useState(false);
  const [showAddLender, setShowAddLender] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);

  const loadEntities = useCallback(async () => {
    const res = await fetch("/api/entities?is_active=true");
    const payload = await res.json();
    if (res.ok) setEntities(payload.data?.data ?? []);
  }, []);

  const loadLenders = useCallback(async () => {
    const res = await fetch("/api/lenders?lender_kind=INSTITUTION");
    const payload = await res.json();
    if (res.ok) setLenders(payload.data?.data ?? []);
  }, []);

  const loadBankAccounts = useCallback(async () => {
    const res = await fetch("/api/bank-accounts?is_active=true");
    const payload = await res.json();
    if (res.ok) setBankAccounts(payload.data?.data ?? []);
  }, []);

  useEffect(() => {
    // The four pickers fill from one round of requests. Until it lands they
    // read "Loading…" rather than "No entities found." — an empty list and a
    // list that hasn't arrived look identical otherwise.
    (async () => {
      setOptionsLoading(true);
      await Promise.allSettled([
        loadEntities(),
        loadLenders(),
        loadBankAccounts(),
        // Vehicles are only offered as collateral, so the list is fetched once
        // and filtered client-side by the typeahead rather than round-tripping.
        (async () => {
          const res = await fetch("/api/vehicles?page=1&pageSize=500");
          const payload = await res.json();
          if (res.ok) setVehicles(payload.data?.data ?? payload.data ?? []);
        })(),
      ]);
      setOptionsLoading(false);
    })();
  }, [loadEntities, loadLenders, loadBankAccounts]);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => applyLoanField(prev, key, value));
      setFieldErrors((prev) => {
        const cleared = { ...prev, [key]: "" };
        // A field filled in for the person is no longer "required" or invalid.
        const after = applyLoanField(form, key, value);
        if (after.firstEmiDate !== form.firstEmiDate) cleared.firstEmiDate = "";
        if (after.emiDayOfMonth !== form.emiDayOfMonth) cleared.emiDayOfMonth = "";
        return cleared;
      });
    },
    [form],
  );

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!form.loanType) errors.loanType = "Loan type is required";
    if (!form.borrowerEntityId) errors.borrowerEntityId = "Borrower is required";
    if (form.principalAmount == null || form.principalAmount <= 0) {
      errors.principalAmount = "Enter the principal amount";
    }
    if (!form.startDate) errors.startDate = "Start date is required";
    if (!form.firstEmiDate) errors.firstEmiDate = "First EMI date is required";
    if (form.firstEmiDate && form.startDate && form.firstEmiDate < form.startDate) {
      errors.firstEmiDate = "First EMI cannot be before the start date";
    }
    if (form.emiAmount == null || form.emiAmount <= 0) {
      errors.emiAmount = "Enter the EMI amount";
    }
    const day = form.emiDayOfMonth;
    if (day == null || day < 1 || day > 31) {
      errors.emiDayOfMonth = "EMI day must be between 1 and 31";
    }
    const total = form.totalInstallments;
    if (total == null || total < 1) {
      errors.totalInstallments = "Enter the number of installments";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    const payload: Record<string, unknown> = {
      loan_type: form.loanType,
      borrower_entity_id: Number(form.borrowerEntityId),
      lender_id: form.lenderId ? Number(form.lenderId) : null,
      loan_number: form.loanNumber.trim() || null,
      vehicle_id: form.vehicleId ? Number(form.vehicleId) : null,
      collateral_description: form.collateralDescription.trim() || null,
      principal_amount: form.principalAmount,
      disbursed_amount: form.disbursedAmount,
      interest_rate: form.interestRate,
      processing_fee: form.processingFee,
      start_date: form.startDate,
      first_emi_date: form.firstEmiDate,
      emi_amount: form.emiAmount,
      emi_day_of_month: day,
      total_installments: total,
      outstanding_override: form.outstandingOverride,
      debit_account_id: form.debitAccountId ? Number(form.debitAccountId) : null,
      mandate_type: form.mandateType || null,
      notes: form.notes.trim() || null,
    };

    if (isEdit) payload.id = loanToEdit!.id;

    try {
      const response = await fetch("/api/loans", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        setSubmitError(data.error || "Failed to save loan");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const today = todayInIndia();

  return (
    <>
      <ModalHeader>
        <ModalTitle>{isEdit ? "Edit Loan" : "New Loan"}</ModalTitle>
        <ModalDescription>
          {isEdit
            ? "Changing the EMI terms rebuilds the remaining schedule. Installments already paid against are left untouched."
            : "Record a loan and its EMI schedule. Every installment is generated up front so payments can be ticked off as they happen."}
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <FormGrid className="mt-2">
          <FormField label="Loan Type" required htmlFor="loan-type" error={fieldErrors.loanType}>
            <LookupSelect
              id="loan-type"
              category="loan_type"
              addLabel="loan type"
              placeholder="Select loan type"
              value={form.loanType}
              onValueChange={(val) => setField("loanType", val)}
              disabled={loading}
              invalid={!!fieldErrors.loanType}
            />
          </FormField>

          <FormField label="In Whose Name" required htmlFor="loan-borrower" error={fieldErrors.borrowerEntityId}>
            <Combobox<Entity>
              id="loan-borrower"
              options={entities}
              value={form.borrowerEntityId}
              onValueChange={(val) => setField("borrowerEntityId", val)}
              getOptionLabel={(e) => e.name}
              getOptionValue={(e) => String(e.id)}
              getOptionDescription={(e) =>
                e.entity_kind === "FIRM" ? "Firm" : "Person"
              }
              placeholder={optionsLoading ? "Loading…" : "Search firms and people..."}
              emptyMessage="No entities found."
              disabled={loading || optionsLoading}
              invalid={!!fieldErrors.borrowerEntityId}
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

          <FormField label="Lender" htmlFor="loan-lender">
            <Combobox<Lender>
              id="loan-lender"
              options={lenders}
              value={form.lenderId}
              onValueChange={(val) => setField("lenderId", val)}
              getOptionLabel={(l) => l.name}
              getOptionValue={(l) => String(l.id)}
              placeholder={optionsLoading ? "Loading…" : "Search lenders..."}
              emptyMessage="No lenders found."
              disabled={loading || optionsLoading}
              clearable
              footer={
                <ComboboxFooterAction
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setShowAddLender(true)}
                >
                  <PlusIcon size={16} />
                  Add new lender
                </ComboboxFooterAction>
              }
            />
          </FormField>

          <FormField label="Loan Number" hint="As printed on the lender&rsquo;s statement (LAN).">
            {(control) => (
              <Input
                {...control}
                disabled={loading}
                value={form.loanNumber}
                onChange={(e) => setField("loanNumber", e.target.value)}
              />
            )}
          </FormField>

          <FormField label="Vehicle (if the loan is on one)" htmlFor="loan-vehicle">
            <Combobox<LinkedVehicle>
              id="loan-vehicle"
              options={vehicles}
              value={form.vehicleId}
              onValueChange={(val) => setField("vehicleId", val)}
              getOptionLabel={(v) => v.vehicle_number}
              getOptionValue={(v) => String(v.id)}
              getOptionDescription={(v) =>
                [v.company, v.model].filter(Boolean).join(" ")
              }
              placeholder={optionsLoading ? "Loading…" : "Search vehicles..."}
              emptyMessage="No vehicles found."
              disabled={loading || optionsLoading}
              clearable
            />
          </FormField>

          <FormField label="Other Collateral">
            {(control) => (
              <Input
                {...control}
                disabled={loading}
                placeholder="e.g. land survey no., gold, vehicle not in fleet"
                value={form.collateralDescription}
                onChange={(e) => setField("collateralDescription", e.target.value)}
              />
            )}
          </FormField>

          <FormField label="Auto-debit from" htmlFor="loan-debit-account">
            <Combobox<BankAccount>
              id="loan-debit-account"
              options={bankAccounts}
              value={form.debitAccountId}
              onValueChange={(val) => setField("debitAccountId", val)}
              getOptionLabel={(a) => formatBankAccountLabel(a, a.entities?.name)}
              getOptionValue={(a) => String(a.id)}
              getOptionDescription={(a) => [a.ifsc, a.branch].filter(Boolean).join(" · ")}
              placeholder={optionsLoading ? "Loading…" : "Search accounts..."}
              emptyMessage="No accounts found."
              disabled={loading || optionsLoading}
              clearable
              footer={
                <ComboboxFooterAction
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setShowAddAccount(true)}
                >
                  <PlusIcon size={16} />
                  Add new account
                </ComboboxFooterAction>
              }
            />
          </FormField>

          <FormField label="Mandate" htmlFor="loan-mandate">
            <Select
              disabled={loading}
              value={form.mandateType || "__none"}
              onValueChange={(val) =>
                setField("mandateType", val === "__none" ? "" : (val as MandateType))
              }
            >
              <SelectTrigger id="loan-mandate">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None</SelectItem>
                {MANDATE_TYPES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Principal Amount (₹)" required error={fieldErrors.principalAmount}>
            {(control) => (
              <MoneyInput
                {...control}
                disabled={loading}
                min={0}
                value={form.principalAmount}
                onValueChange={(v) => setField("principalAmount", v)}
              />
            )}
          </FormField>

          <FormField
            label="Disbursed Amount (₹)"
            hint="What actually landed in the account, if different from the sanctioned principal (after processing fee or other deductions)."
          >
            {(control) => (
              <MoneyInput
                {...control}
                disabled={loading}
                min={0}
                placeholder="Leave blank if same as principal"
                value={form.disbursedAmount}
                onValueChange={(v) => setField("disbursedAmount", v)}
              />
            )}
          </FormField>

          <FormField label="Interest Rate (% p.a.)">
            {(control) => (
              <NumberInput
                {...control}
                disabled={loading}
                min={0}
                maxDecimals={2}
                step={0.01}
                value={form.interestRate}
                onValueChange={(v) => setField("interestRate", v)}
              />
            )}
          </FormField>

          <FormField label="Start Date" required error={fieldErrors.startDate}>
            {(control) => (
              <DatePicker
                {...control}
                today={today}
                disabled={loading}
                invalid={!!fieldErrors.startDate}
                value={form.startDate || null}
                onValueChange={(v) => setField("startDate", v ?? "")}
              />
            )}
          </FormField>

          <FormField label="First EMI Date" required error={fieldErrors.firstEmiDate}>
            {(control) => (
              <DatePicker
                {...control}
                today={today}
                disabled={loading}
                invalid={!!fieldErrors.firstEmiDate}
                value={form.firstEmiDate || null}
                onValueChange={(v) => setField("firstEmiDate", v ?? "")}
              />
            )}
          </FormField>

          <FormField label="EMI Amount (₹)" required error={fieldErrors.emiAmount}>
            {(control) => (
              <MoneyInput
                {...control}
                disabled={loading}
                min={0}
                value={form.emiAmount}
                onValueChange={(v) => setField("emiAmount", v)}
              />
            )}
          </FormField>

          <FormField
            label="EMI Day of Month"
            required
            error={fieldErrors.emiDayOfMonth}
            hint="Short months fall back to the last day — 31 becomes 28 in February."
          >
            {(control) => (
              <NumberInput
                {...control}
                disabled={loading}
                placeholder="1–31"
                value={form.emiDayOfMonth}
                onValueChange={(v) => setField("emiDayOfMonth", v)}
              />
            )}
          </FormField>

          <FormField label="Total Installments" required error={fieldErrors.totalInstallments}>
            {(control) => (
              <NumberInput
                {...control}
                disabled={loading}
                value={form.totalInstallments}
                onValueChange={(v) => setField("totalInstallments", v)}
              />
            )}
          </FormField>

          <FormField label="Processing Fee (₹)">
            {(control) => (
              <MoneyInput
                {...control}
                disabled={loading}
                min={0}
                value={form.processingFee}
                onValueChange={(v) => setField("processingFee", v)}
              />
            )}
          </FormField>

          <FormField
            className="sm:col-span-2"
            label="Outstanding Override (₹)"
            hint="Only for matching a figure the lender has quoted. Once set, it replaces the calculated outstanding everywhere."
          >
            {(control) => (
              <MoneyInput
                {...control}
                disabled={loading}
                min={0}
                placeholder="Leave blank to derive from the schedule"
                value={form.outstandingOverride}
                onValueChange={(v) => setField("outstandingOverride", v)}
              />
            )}
          </FormField>

          <FormField className="sm:col-span-2" label="Notes">
            {(control) => (
              <>
                <Textarea
                  {...control}
                  rows={3}
                  disabled={loading}
                  maxLength={LOAN_NOTES_MAX_LENGTH}
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                />
                <span className="self-end text-xs text-muted-foreground">
                  {form.notes.length}/{LOAN_NOTES_MAX_LENGTH}
                </span>
              </>
            )}
          </FormField>
        </FormGrid>

        {submitError && (
          <Alert tone="danger" className="mt-4">
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
          {loading ? "Saving..." : isEdit ? "Update Loan" : "Save Loan"}
        </Button>
      </ModalFooter>

      <EntityModal
        nested
        isOpen={showAddEntity}
        onClose={() => setShowAddEntity(false)}
        onSuccess={(entity) => {
          setEntities((prev) => [...prev, entity]);
          setField("borrowerEntityId", String(entity.id));
        }}
      />

      <LenderModal
        nested
        isOpen={showAddLender}
        defaultKind="INSTITUTION"
        onClose={() => setShowAddLender(false)}
        onSuccess={(lender) => {
          setLenders((prev) => [...prev, lender]);
          setField("lenderId", String(lender.id));
        }}
      />

      <BankAccountModal
        nested
        isOpen={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSuccess={(account) => {
          setBankAccounts((prev) => [...prev, account]);
          setField("debitAccountId", String(account.id));
        }}
      />
    </>
  );
};

const LoanModal: React.FC<LoanModalProps> = ({
  isOpen,
  loanToEdit,
  onClose,
  onSuccess,
}) => (
  <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <ModalContent style={{ maxWidth: "52rem", padding: 0 }}>
      {/* Mounted only while open so form state resets between records. */}
      {isOpen && (
        <LoanForm loanToEdit={loanToEdit} onClose={onClose} onSuccess={onSuccess} />
      )}
    </ModalContent>
  </Modal>
);

export { LoanModal };
export default LoanModal;
