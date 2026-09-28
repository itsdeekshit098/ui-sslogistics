"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SaveIcon, PlusIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Typeahead, typeaheadFooterActionClassName } from "@/components/typeahead";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { LenderModal } from "@/components/lenderModal";
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
  INTEREST_MODES,
  LOAN_NOTES_MAX_LENGTH,
  ROI_BASES,
  type Lender,
} from "@/components/loansPage/loansPage.types";
import { formatCurrency, todayString } from "@/lib/format";
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
  const [amount, setAmount] = useState("");
  const [interestMode, setInterestMode] = useState<string>("PERCENT");
  const [roi, setRoi] = useState("");
  const [roiBasis, setRoiBasis] = useState<string>("MONTHLY");
  const [fixedAmount, setFixedAmount] = useState("");
  const [interestDueDay, setInterestDueDay] = useState("");
  const [startDate, setStartDate] = useState(todayString());
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
    const principal = Number(amount);
    if (!principal || principal <= 0) return null;
    if (isPercent) {
      const rate = Number(roi);
      if (!rate) return null;
      const monthly = roiBasis === "ANNUAL" ? rate / 12 : rate;
      return (principal * monthly) / 100;
    }
    const fixed = Number(fixedAmount);
    return fixed || null;
  })();

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!counterpartyId) errors.counterpartyId = `${copy.counterpartyLabel} is required`;
    if (!amount || Number(amount) <= 0) errors.amount = copy.amountErrorFallback;
    if (!startDate) errors.startDate = "Start date is required";
    if (isPercent && (!roi || Number(roi) < 0)) errors.roi = "Enter the rate";
    if (!isPercent && (!fixedAmount || Number(fixedAmount) < 0)) {
      errors.fixedAmount = "Enter the monthly interest amount";
    }
    if (interestDueDay) {
      const day = Number(interestDueDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        errors.interestDueDay = "Day must be between 1 and 31";
      }
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
          amount: Number(amount),
          interest_mode: interestMode,
          roi: isPercent ? Number(roi) : null,
          roi_basis: isPercent ? roiBasis : null,
          fixed_interest_amount: isPercent ? null : Number(fixedAmount),
          interest_due_day: interestDueDay ? Number(interestDueDay) : null,
          start_date: startDate,
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

  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name] ? (
      <span className="text-xs text-destructive">{fieldErrors[name]}</span>
    ) : null;

  return (
    <>
      <ModalHeader>
        <ModalTitle>{copy.title}</ModalTitle>
        <ModalDescription>{copy.description}</ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="funding-counterparty">
              {copy.counterpartyLabel} <span className="text-destructive">*</span>
            </Label>
            {isLent ? (
              <Typeahead<Entity>
                id="funding-counterparty"
                options={entities}
                value={counterpartyId}
                onValueChange={setCounterpartyId}
                getOptionLabel={(e) => e.name}
                getOptionValue={(e) => String(e.id)}
                getOptionDescription={(e) => (e.entity_kind === "FIRM" ? "Firm" : "Person")}
                placeholder={optionsLoading ? "Loading…" : copy.counterpartyPlaceholder}
                emptyMessage={copy.counterpartyEmpty}
                disabled={loading || optionsLoading}
                invalid={!!fieldErrors.counterpartyId}
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
            ) : (
              <Typeahead<Lender>
                id="funding-counterparty"
                options={funders}
                value={counterpartyId}
                onValueChange={setCounterpartyId}
                getOptionLabel={(l) => l.name}
                getOptionValue={(l) => String(l.id)}
                getOptionDescription={(l) => l.phone ?? ""}
                placeholder={optionsLoading ? "Loading…" : copy.counterpartyPlaceholder}
                emptyMessage={copy.counterpartyEmpty}
                disabled={loading || optionsLoading}
                invalid={!!fieldErrors.counterpartyId}
                footer={
                  <Button
                    variant="ghost"
                    className={typeaheadFooterActionClassName}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setShowAddFunder(true)}
                  >
                    <PlusIcon size={16} />
                    Add new funder
                  </Button>
                }
              />
            )}
            <FieldError name="counterpartyId" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="funding-borrower">In Whose Name</Label>
            <Typeahead<Entity>
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
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="funding-amount">
              {copy.amountLabel} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="funding-amount"
              type="number"
              inputMode="numeric"
              disabled={loading}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setFieldErrors((p) => ({ ...p, amount: "" }));
              }}
              className={fieldErrors.amount ? "border-destructive" : ""}
            />
            <FieldError name="amount" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="funding-start">
              {copy.dateLabel} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="funding-start"
              type="date"
              disabled={loading}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={fieldErrors.startDate ? "border-destructive" : ""}
            />
            <FieldError name="startDate" />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="funding-mode">How is interest agreed?</Label>
            <Select
              disabled={loading}
              value={interestMode}
              onValueChange={setInterestMode}
            >
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
          </div>

          {isPercent ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="funding-roi">
                  Rate (%) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="funding-roi"
                  type="number"
                  step="0.01"
                  disabled={loading}
                  placeholder="e.g. 2"
                  value={roi}
                  onChange={(e) => {
                    setRoi(e.target.value);
                    setFieldErrors((p) => ({ ...p, roi: "" }));
                  }}
                  className={fieldErrors.roi ? "border-destructive" : ""}
                />
                <FieldError name="roi" />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="funding-basis">Per</Label>
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
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="funding-fixed">
                Interest per Month (₹) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="funding-fixed"
                type="number"
                disabled={loading}
                value={fixedAmount}
                onChange={(e) => {
                  setFixedAmount(e.target.value);
                  setFieldErrors((p) => ({ ...p, fixedAmount: "" }));
                }}
                className={fieldErrors.fixedAmount ? "border-destructive" : ""}
              />
              <FieldError name="fixedAmount" />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="funding-due-day">{copy.dueDayLabel}</Label>
            <Input
              id="funding-due-day"
              type="number"
              min={1}
              max={31}
              disabled={loading}
              placeholder="1–31"
              value={interestDueDay}
              onChange={(e) => {
                setInterestDueDay(e.target.value);
                setFieldErrors((p) => ({ ...p, interestDueDay: "" }));
              }}
              className={fieldErrors.interestDueDay ? "border-destructive" : ""}
            />
            <FieldError name="interestDueDay" />
          </div>

          {monthlyPreview != null && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm sm:col-span-2">
              At this rate, a full month costs{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(monthlyPreview)}
              </span>
              . A part month is charged proportionally.
            </div>
          )}

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="funding-notes">Notes</Label>
            <Textarea
              id="funding-notes"
              rows={3}
              disabled={loading}
              maxLength={LOAN_NOTES_MAX_LENGTH}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
