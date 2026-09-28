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
import { LenderModal } from "@/components/lenderModal";
import { BankAccountModal } from "@/components/bankAccountModal";
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
import type { LoanModalProps } from "./loanModal.types";

interface FormState {
  loanType: string;
  borrowerEntityId: string;
  lenderId: string;
  loanNumber: string;
  vehicleId: string;
  collateralDescription: string;
  principalAmount: string;
  disbursedAmount: string;
  interestRate: string;
  processingFee: string;
  startDate: string;
  firstEmiDate: string;
  emiAmount: string;
  emiDayOfMonth: string;
  totalInstallments: string;
  outstandingOverride: string;
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
    principalAmount: loan ? String(loan.principal_amount) : "",
    disbursedAmount: loan?.disbursed_amount != null ? String(loan.disbursed_amount) : "",
    interestRate: loan?.interest_rate != null ? String(loan.interest_rate) : "",
    processingFee: loan?.processing_fee != null ? String(loan.processing_fee) : "",
    startDate: loan?.start_date ?? "",
    firstEmiDate: loan?.first_emi_date ?? "",
    emiAmount: loan ? String(loan.emi_amount) : "",
    emiDayOfMonth: loan ? String(loan.emi_day_of_month) : "",
    totalInstallments: loan ? String(loan.total_installments) : "",
    outstandingOverride:
      loan?.outstanding_override != null ? String(loan.outstanding_override) : "",
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
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        // The first EMI is almost always a month after disbursal and the EMI
        // day follows from it — prefilling both saves the common case without
        // blocking the odd one, since either can still be overridden.
        if (key === "startDate" && value && !prev.firstEmiDate) {
          const [y, m, d] = String(value).split("-").map(Number);
          const suggested = new Date(Date.UTC(y, m, d));
          next.firstEmiDate = suggested.toISOString().slice(0, 10);
          if (!prev.emiDayOfMonth) next.emiDayOfMonth = String(d);
        }
        if (key === "firstEmiDate" && value && !prev.emiDayOfMonth) {
          next.emiDayOfMonth = String(Number(String(value).slice(8, 10)));
        }
        return next;
      });
      setFieldErrors((prev) => ({ ...prev, [key]: "" }));
    },
    [],
  );

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!form.loanType) errors.loanType = "Loan type is required";
    if (!form.borrowerEntityId) errors.borrowerEntityId = "Borrower is required";
    if (!form.principalAmount || Number(form.principalAmount) <= 0) {
      errors.principalAmount = "Enter the principal amount";
    }
    if (!form.startDate) errors.startDate = "Start date is required";
    if (!form.firstEmiDate) errors.firstEmiDate = "First EMI date is required";
    if (form.firstEmiDate && form.startDate && form.firstEmiDate < form.startDate) {
      errors.firstEmiDate = "First EMI cannot be before the start date";
    }
    if (!form.emiAmount || Number(form.emiAmount) <= 0) {
      errors.emiAmount = "Enter the EMI amount";
    }
    const day = Number(form.emiDayOfMonth);
    if (!form.emiDayOfMonth || !Number.isInteger(day) || day < 1 || day > 31) {
      errors.emiDayOfMonth = "EMI day must be between 1 and 31";
    }
    const total = Number(form.totalInstallments);
    if (!form.totalInstallments || !Number.isInteger(total) || total < 1) {
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
      principal_amount: Number(form.principalAmount),
      disbursed_amount: form.disbursedAmount ? Number(form.disbursedAmount) : null,
      interest_rate: form.interestRate ? Number(form.interestRate) : null,
      processing_fee: form.processingFee ? Number(form.processingFee) : null,
      start_date: form.startDate,
      first_emi_date: form.firstEmiDate,
      emi_amount: Number(form.emiAmount),
      emi_day_of_month: day,
      total_installments: total,
      outstanding_override: form.outstandingOverride
        ? Number(form.outstandingOverride)
        : null,
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

  const errorClass = (key: string) => (fieldErrors[key] ? "border-destructive" : "");
  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name] ? (
      <span className="text-xs text-destructive">{fieldErrors[name]}</span>
    ) : null;

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
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-type">
              Loan Type <span className="text-destructive">*</span>
            </Label>
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
            <FieldError name="loanType" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-borrower">
              In Whose Name <span className="text-destructive">*</span>
            </Label>
            <Typeahead<Entity>
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
            <FieldError name="borrowerEntityId" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-lender">Lender</Label>
            <Typeahead<Lender>
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
                <Button
                  variant="ghost"
                  className={typeaheadFooterActionClassName}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setShowAddLender(true)}
                >
                  <PlusIcon size={16} />
                  Add new lender
                </Button>
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-account">Loan Number</Label>
            <Input
              id="loan-account"
              disabled={loading}
              value={form.loanNumber}
              onChange={(e) => setField("loanNumber", e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              As printed on the lender&rsquo;s statement (LAN).
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-vehicle">Vehicle (if the loan is on one)</Label>
            <Typeahead<LinkedVehicle>
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
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-collateral">Other Collateral</Label>
            <Input
              id="loan-collateral"
              disabled={loading}
              placeholder="e.g. land survey no., gold, vehicle not in fleet"
              value={form.collateralDescription}
              onChange={(e) => setField("collateralDescription", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-debit-account">Auto-debit from</Label>
            <Typeahead<BankAccount>
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
                <Button
                  variant="ghost"
                  className={typeaheadFooterActionClassName}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setShowAddAccount(true)}
                >
                  <PlusIcon size={16} />
                  Add new account
                </Button>
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-mandate">Mandate</Label>
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
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-principal">
              Principal Amount (₹) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="loan-principal"
              type="number"
              inputMode="numeric"
              disabled={loading}
              value={form.principalAmount}
              onChange={(e) => setField("principalAmount", e.target.value)}
              className={errorClass("principalAmount")}
            />
            <FieldError name="principalAmount" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-disbursed">Disbursed Amount (₹)</Label>
            <Input
              id="loan-disbursed"
              type="number"
              inputMode="numeric"
              disabled={loading}
              placeholder="Leave blank if same as principal"
              value={form.disbursedAmount}
              onChange={(e) => setField("disbursedAmount", e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              What actually landed in the account, if different from the
              sanctioned principal (after processing fee or other deductions).
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-rate">Interest Rate (% p.a.)</Label>
            <Input
              id="loan-rate"
              type="number"
              step="0.01"
              disabled={loading}
              value={form.interestRate}
              onChange={(e) => setField("interestRate", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-start">
              Start Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="loan-start"
              type="date"
              disabled={loading}
              value={form.startDate}
              onChange={(e) => setField("startDate", e.target.value)}
              className={errorClass("startDate")}
            />
            <FieldError name="startDate" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-first-emi">
              First EMI Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="loan-first-emi"
              type="date"
              disabled={loading}
              value={form.firstEmiDate}
              onChange={(e) => setField("firstEmiDate", e.target.value)}
              className={errorClass("firstEmiDate")}
            />
            <FieldError name="firstEmiDate" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-emi">
              EMI Amount (₹) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="loan-emi"
              type="number"
              inputMode="numeric"
              disabled={loading}
              value={form.emiAmount}
              onChange={(e) => setField("emiAmount", e.target.value)}
              className={errorClass("emiAmount")}
            />
            <FieldError name="emiAmount" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-emi-day">
              EMI Day of Month <span className="text-destructive">*</span>
            </Label>
            <Input
              id="loan-emi-day"
              type="number"
              min={1}
              max={31}
              disabled={loading}
              placeholder="1–31"
              value={form.emiDayOfMonth}
              onChange={(e) => setField("emiDayOfMonth", e.target.value)}
              className={errorClass("emiDayOfMonth")}
            />
            <span className="text-xs text-muted-foreground">
              Short months fall back to the last day — 31 becomes 28 in February.
            </span>
            <FieldError name="emiDayOfMonth" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-total">
              Total Installments <span className="text-destructive">*</span>
            </Label>
            <Input
              id="loan-total"
              type="number"
              min={1}
              disabled={loading}
              value={form.totalInstallments}
              onChange={(e) => setField("totalInstallments", e.target.value)}
              className={errorClass("totalInstallments")}
            />
            <FieldError name="totalInstallments" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-fee">Processing Fee (₹)</Label>
            <Input
              id="loan-fee"
              type="number"
              disabled={loading}
              value={form.processingFee}
              onChange={(e) => setField("processingFee", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="loan-override">Outstanding Override (₹)</Label>
            <Input
              id="loan-override"
              type="number"
              disabled={loading}
              placeholder="Leave blank to derive from the schedule"
              value={form.outstandingOverride}
              onChange={(e) => setField("outstandingOverride", e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Only for matching a figure the lender has quoted. Once set, it
              replaces the calculated outstanding everywhere.
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="loan-notes">Notes</Label>
            <Textarea
              id="loan-notes"
              rows={3}
              disabled={loading}
              maxLength={LOAN_NOTES_MAX_LENGTH}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
            />
            <span className="self-end text-xs text-muted-foreground">
              {form.notes.length}/{LOAN_NOTES_MAX_LENGTH}
            </span>
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
