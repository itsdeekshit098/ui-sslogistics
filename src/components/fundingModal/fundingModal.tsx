"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SaveIcon, PlusIcon } from "@ui/icons";
import { Button } from "@ui/components/button";
import { FormField } from "@ui/components/formField";
import { FormGrid } from "@ui/components/formGrid";
import { Alert } from "@ui/components/alert";
import { DatePicker } from "@ui/components/datePicker";
import { MoneyInput } from "@ui/components/moneyInput";
import { NumberInput } from "@ui/components/numberInput";
import { Textarea } from "@ui/components/textarea";
import { Combobox, ComboboxFooterAction } from "@ui/components/combobox";
import { Spinner } from "@ui/components/spinner";
import { LenderModal } from "@/components/lenderModal";
import { EntityModal } from "@/components/entityModal";
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
  INTEREST_MODES,
  LOAN_NOTES_MAX_LENGTH,
  ROI_BASES,
  type Lender,
} from "@/components/loansPage/loansPage.types";
import { formatCurrency } from "@/lib/format";
import { todayInIndia } from "@/lib/dateOnly";
import type { FundingDirection, FundingModalProps } from "./fundingModal.types";

/** Copy that changes with direction; the arithmetic (fundings.utils.ts)
 * doesn't care which way the money moved. */
const DIRECTION_COPY: Record<
  FundingDirection,
  {
    title: string;
    description: string;
    counterpartyLabel: string;
    counterpartyPlaceholder: string;
    counterpartyEmpty: string;
    amountLabel: string;
    amountErrorFallback: string;
    dateLabel: string;
    dueDayLabel: string;
    submitLabel: string;
  }
> = {
  BORROWED: {
    title: "New Private Funding",
    description:
      "Money borrowed from an individual at an agreed rate. Interest is simple " +
      "and never compounds — it accrues on whatever principal is outstanding, " +
      "day by day, whether or not it has been paid.",
    counterpartyLabel: "Funder",
    counterpartyPlaceholder: "Search funders...",
    counterpartyEmpty: "No private funders yet.",
    amountLabel: "Amount Borrowed (₹)",
    amountErrorFallback: "Enter the amount borrowed",
    dateLabel: "Date Borrowed",
    dueDayLabel: "Interest Expected On (day)",
    submitLabel: "Save Funding",
  },
  LENT: {
    title: "New Money Lent",
    description:
      "Money lent to an individual at an agreed rate. Interest is simple and " +
      "never compounds — it accrues on whatever principal is still out, day " +
      "by day, whether or not it has been received.",
    counterpartyLabel: "Borrower",
    counterpartyPlaceholder: "Search firms and people...",
    counterpartyEmpty: "No entities found.",
    amountLabel: "Amount Lent (₹)",
    amountErrorFallback: "Enter the amount lent",
    dateLabel: "Date Lent",
    dueDayLabel: "Interest Due From Them (day)",
    submitLabel: "Save",
  },
};

const FundingForm: React.FC<{
  direction: FundingDirection;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ direction, onClose, onSuccess }) => {
  const copy = DIRECTION_COPY[direction];
  const isLent = direction === "LENT";

  const [counterpartyId, setCounterpartyId] = useState("");
  const [borrowerEntityId, setBorrowerEntityId] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [interestMode, setInterestMode] = useState<string>("PERCENT");
  const [roi, setRoi] = useState<number | null>(null);
  const [roiBasis, setRoiBasis] = useState<string>("MONTHLY");
  const [fixedAmount, setFixedAmount] = useState<number | null>(null);
  const [interestDueDay, setInterestDueDay] = useState<number | null>(null);
  // The business day in India: the UTC date is still "yesterday" until 05:30.
  const today = todayInIndia();
  const [startDate, setStartDate] = useState<string | null>(today);
  const [notes, setNotes] = useState("");

  const [funders, setFunders] = useState<Lender[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showAddFunder, setShowAddFunder] = useState(false);
  const [showAddEntity, setShowAddEntity] = useState(false);

  useEffect(() => {
    (async () => {
      // Private funders only — a bank doesn't lend on these terms, and mixing
      // them into the list is how duplicate "HDFC" rows get created.
      const [funderRes, entityRes] = await Promise.all([
        fetch("/api/lenders?lender_kind=PRIVATE"),
        fetch("/api/entities?is_active=true"),
      ]);
      const [funderJson, entityJson] = await Promise.all([
        funderRes.json(),
        entityRes.json(),
      ]);
      if (funderRes.ok) setFunders(funderJson.data?.data ?? []);
      if (entityRes.ok) setEntities(entityJson.data?.data ?? []);
    })().finally(() => setOptionsLoading(false));
  }, []);

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const isPercent = interestMode === "PERCENT";

  // Shows the user what the agreed rate actually costs per month, before they
  // commit to it — the number they'll be reconciling against every month.
  const monthlyPreview = (() => {
    const principal = amount;
    if (!principal || principal <= 0) return null;
    if (isPercent) {
      if (!roi) return null;
      const monthly = roiBasis === "ANNUAL" ? roi / 12 : roi;
      return (principal * monthly) / 100;
    }
    return fixedAmount || null;
  })();

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!counterpartyId) errors.counterpartyId = `${copy.counterpartyLabel} is required`;
    if (amount == null || amount <= 0) errors.amount = copy.amountErrorFallback;
    if (!startDate) errors.startDate = "Start date is required";
    if (isPercent && (roi == null || roi < 0)) errors.roi = "Enter the rate";
    if (!isPercent && (fixedAmount == null || fixedAmount < 0)) {
      errors.fixedAmount = "Enter the monthly interest amount";
    }
    if (interestDueDay != null && (interestDueDay < 1 || interestDueDay > 31)) {
      errors.interestDueDay = "Day must be between 1 and 31";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/fundings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          funder_id: isLent ? null : Number(counterpartyId),
          counterparty_entity_id: isLent ? Number(counterpartyId) : null,
          borrower_entity_id: borrowerEntityId ? Number(borrowerEntityId) : null,
          amount,
          interest_mode: interestMode,
          roi: isPercent ? roi : null,
          roi_basis: isPercent ? roiBasis : null,
          fixed_interest_amount: isPercent ? null : fixedAmount,
          interest_due_day: interestDueDay,
          start_date: startDate ?? today,
          notes: notes.trim() || null,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        setSubmitError(data.error || "Failed to save funding");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const clearError = (name: string) => setFieldErrors((p) => ({ ...p, [name]: "" }));

  return (
    <>
      <ModalHeader>
        <ModalTitle>{copy.title}</ModalTitle>
        <ModalDescription>{copy.description}</ModalDescription>
      </ModalHeader>

      <ModalBody>
        <FormGrid className="mt-2">
          <FormField
            label={copy.counterpartyLabel}
            required
            htmlFor="funding-counterparty"
            error={fieldErrors.counterpartyId}
          >
            {isLent ? (
              <Combobox<Entity>
                id="funding-counterparty"
                options={entities}
                value={counterpartyId}
                onValueChange={(next) => {
                  setCounterpartyId(next);
                  clearError("counterpartyId");
                }}
                getOptionLabel={(e) => e.name}
                getOptionValue={(e) => String(e.id)}
                getOptionDescription={(e) => (e.entity_kind === "FIRM" ? "Firm" : "Person")}
                placeholder={optionsLoading ? "Loading…" : copy.counterpartyPlaceholder}
                emptyMessage={copy.counterpartyEmpty}
                disabled={loading || optionsLoading}
                invalid={!!fieldErrors.counterpartyId}
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
            ) : (
              <Combobox<Lender>
                id="funding-counterparty"
                options={funders}
                value={counterpartyId}
                onValueChange={(next) => {
                  setCounterpartyId(next);
                  clearError("counterpartyId");
                }}
                getOptionLabel={(l) => l.name}
                getOptionValue={(l) => String(l.id)}
                getOptionDescription={(l) => l.phone ?? ""}
                placeholder={optionsLoading ? "Loading…" : copy.counterpartyPlaceholder}
                emptyMessage={copy.counterpartyEmpty}
                disabled={loading || optionsLoading}
                invalid={!!fieldErrors.counterpartyId}
                footer={
                  <ComboboxFooterAction
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setShowAddFunder(true)}
                  >
                    <PlusIcon size={16} />
                    Add new funder
                  </ComboboxFooterAction>
                }
              />
            )}
          </FormField>

          <FormField label="In Whose Name" htmlFor="funding-borrower">
            <Combobox<Entity>
              id="funding-borrower"
              options={entities}
              value={borrowerEntityId}
              onValueChange={setBorrowerEntityId}
              getOptionLabel={(e) => e.name}
              getOptionValue={(e) => String(e.id)}
              placeholder={optionsLoading ? "Loading…" : "Search firms and people..."}
              emptyMessage="No entities found."
              disabled={loading || optionsLoading}
              clearable
            />
          </FormField>

          <FormField label={copy.amountLabel} required error={fieldErrors.amount}>
            {(control) => (
              <MoneyInput
                {...control}
                disabled={loading}
                min={0}
                value={amount}
                onValueChange={(v) => {
                  setAmount(v);
                  clearError("amount");
                }}
              />
            )}
          </FormField>

          <FormField label={copy.dateLabel} required error={fieldErrors.startDate}>
            {(control) => (
              <DatePicker
                {...control}
                today={today}
                disabled={loading}
                invalid={!!fieldErrors.startDate}
                value={startDate}
                onValueChange={(v) => {
                  setStartDate(v);
                  clearError("startDate");
                }}
              />
            )}
          </FormField>

          <FormField className="sm:col-span-2" label="How is interest agreed?" htmlFor="funding-mode">
            <Select disabled={loading} value={interestMode} onValueChange={setInterestMode}>
              <SelectTrigger id="funding-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTEREST_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {isPercent ? (
            <>
              <FormField label="Rate (%)" required error={fieldErrors.roi}>
                {(control) => (
                  <NumberInput
                    {...control}
                    disabled={loading}
                    min={0}
                    maxDecimals={2}
                    step={0.01}
                    placeholder="e.g. 2"
                    value={roi}
                    onValueChange={(v) => {
                      setRoi(v);
                      clearError("roi");
                    }}
                  />
                )}
              </FormField>

              <FormField label="Per" htmlFor="funding-basis">
                <Select disabled={loading} value={roiBasis} onValueChange={setRoiBasis}>
                  <SelectTrigger id="funding-basis">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROI_BASES.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </>
          ) : (
            <FormField label="Interest per Month (₹)" required error={fieldErrors.fixedAmount}>
              {(control) => (
                <MoneyInput
                  {...control}
                  disabled={loading}
                  min={0}
                  value={fixedAmount}
                  onValueChange={(v) => {
                    setFixedAmount(v);
                    clearError("fixedAmount");
                  }}
                />
              )}
            </FormField>
          )}

          <FormField label={copy.dueDayLabel} error={fieldErrors.interestDueDay}>
            {(control) => (
              <NumberInput
                {...control}
                disabled={loading}
                placeholder="1–31"
                value={interestDueDay}
                onValueChange={(v) => {
                  setInterestDueDay(v);
                  clearError("interestDueDay");
                }}
              />
            )}
          </FormField>

          {monthlyPreview != null && (
            <Alert tone="info" icon={null} className="sm:col-span-2">
              At this rate, a full month costs{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(monthlyPreview)}
              </span>
              . A part month is charged proportionally.
            </Alert>
          )}

          <FormField className="sm:col-span-2" label="Notes">
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                disabled={loading}
                maxLength={LOAN_NOTES_MAX_LENGTH}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
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
          {loading ? "Saving..." : copy.submitLabel}
        </Button>
      </ModalFooter>

      <LenderModal
        nested
        isOpen={showAddFunder}
        defaultKind="PRIVATE"
        onClose={() => setShowAddFunder(false)}
        onSuccess={(lender) => {
          setFunders((prev) => [...prev, lender]);
          setCounterpartyId(String(lender.id));
        }}
      />

      <EntityModal
        nested
        isOpen={showAddEntity}
        onClose={() => setShowAddEntity(false)}
        onSuccess={(entity) => {
          setEntities((prev) => [...prev, entity]);
          setCounterpartyId(String(entity.id));
        }}
      />
    </>
  );
};

const FundingModal: React.FC<FundingModalProps> = ({
  isOpen,
  direction = "BORROWED",
  onClose,
  onSuccess,
}) => (
  <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <ModalContent style={{ maxWidth: "44rem", padding: 0 }}>
      {isOpen && (
        <FundingForm direction={direction} onClose={onClose} onSuccess={onSuccess} />
      )}
    </ModalContent>
  </Modal>
);

export { FundingModal };
export default FundingModal;
