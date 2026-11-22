"use client";

import React, { useState } from "react";
import { SaveIcon } from "@ui/icons";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { FormField } from "@ui/components/formField";
import { Alert } from "@ui/components/alert";
import { DatePicker } from "@ui/components/datePicker";
import { MoneyInput } from "@ui/components/moneyInput";
import { Textarea } from "@ui/components/textarea";
import { LookupSelect } from "@/components/lookupSelect";
import { Spinner } from "@ui/components/spinner";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@ui/components/modal";
import type { FundingDirection, FundingEntryType } from "@/components/loansPage/loansPage.types";
import { formatCurrencyPrecise } from "@/lib/format";
import { todayInIndia } from "@/lib/dateOnly";

export interface FundingEntryModalProps {
  isOpen: boolean;
  fundingId: number;
  entryType: FundingEntryType;
  /** Which side of the arrangement this is — flips the copy between borrower
   * voice and lender voice. Defaults to BORROWED. */
  direction?: FundingDirection;
  /** Prefills the amount — interest due, or principal outstanding. */
  suggestedAmount?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const COPY: Record<
  FundingDirection,
  Record<FundingEntryType, { title: string; description: string }>
> = {
  BORROWED: {
    PRINCIPAL_TAKEN: {
      title: "Borrow More",
      description:
        "Additional money taken from this funder. It joins the same arrangement and starts accruing interest from its own date.",
    },
    PRINCIPAL_REPAID: {
      title: "Repay Principal",
      description:
        "Principal returned to the funder. Interest from this date onward accrues on the reduced amount.",
    },
    INTEREST_PAID: {
      title: "Pay Interest",
      description:
        "Interest handed over. This never touches the principal — the monthly accrual stays the same.",
    },
    ADJUSTMENT: {
      title: "Adjustment",
      description: "An agreed write-off or correction against the principal.",
    },
  },
  LENT: {
    PRINCIPAL_TAKEN: {
      title: "Lend More",
      description:
        "Additional money given to this borrower. It joins the same arrangement and starts accruing interest from its own date.",
    },
    PRINCIPAL_REPAID: {
      title: "Recover Principal",
      description:
        "Principal returned by the borrower. Interest from this date onward accrues on the reduced amount.",
    },
    INTEREST_PAID: {
      title: "Receive Interest",
      description:
        "Interest received. This never touches the principal — the monthly accrual stays the same.",
    },
    ADJUSTMENT: {
      title: "Adjustment",
      description: "An agreed write-off or correction against the principal.",
    },
  },
};

const FundingEntryForm: React.FC<Omit<FundingEntryModalProps, "isOpen">> = ({
  fundingId,
  entryType,
  direction = "BORROWED",
  suggestedAmount,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<number | null>(
    suggestedAmount && suggestedAmount > 0 ? Number(suggestedAmount.toFixed(2)) : null,
  );
  // The business day in India: the UTC date is still "yesterday" until 05:30.
  const today = todayInIndia();
  const [entryDate, setEntryDate] = useState<string | null>(today);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[direction][entryType];

  const handleSubmit = async () => {
    if (amount == null || amount <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/fundings/${fundingId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_type: entryType,
          amount,
          entry_date: entryDate ?? today,
          payment_method: paymentMethod || null,
          reference: reference.trim() || null,
          description: description.trim() || null,
        }),
      });
      const json = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(json.error || "Failed to record entry");
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
        <ModalTitle>{copy.title}</ModalTitle>
        <ModalDescription>{copy.description}</ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="flex flex-col gap-4">
          <FormField
            label="Amount (₹)"
            required
            hint={
              suggestedAmount != null && suggestedAmount > 0
                ? `Suggested: ${formatCurrencyPrecise(suggestedAmount)}`
                : undefined
            }
          >
            {(control) => (
              <MoneyInput
                {...control}
                autoFocus
                min={0}
                disabled={loading}
                value={amount}
                onValueChange={(v) => {
                  setAmount(v);
                  setError(null);
                }}
              />
            )}
          </FormField>

          <FormField
            label="Date"
            hint="Backdating is fine — interest is recalculated from scratch, so the figures land where they should."
          >
            {(control) => (
              <DatePicker
                {...control}
                today={today}
                disabled={loading}
                value={entryDate}
                onValueChange={setEntryDate}
              />
            )}
          </FormField>

          <FormField label="Payment Method" htmlFor="entry-method">
            <LookupSelect
              id="entry-method"
              category="payment_method"
              addLabel="payment method"
              placeholder="Select method"
              value={paymentMethod}
              onValueChange={setPaymentMethod}
              disabled={loading}
            />
          </FormField>

          <FormField label="Reference">
            {(control) => (
              <Input
                {...control}
                disabled={loading}
                placeholder="UTR / cheque no."
                maxLength={100}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            )}
          </FormField>

          <FormField label="Description">
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                maxLength={300}
                disabled={loading}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </FormField>
        </div>

        {error && (
          <Alert tone="danger" className="mt-4" scrollIntoView>
            {error}
          </Alert>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
          )}
          {loading ? "Saving..." : "Record"}
        </Button>
      </ModalFooter>
    </>
  );
};

export const FundingEntryModal: React.FC<FundingEntryModalProps> = ({
  isOpen,
  ...rest
}) => (
  <Modal open={isOpen} onOpenChange={(open) => !open && rest.onClose()}>
    <ModalContent style={{ maxWidth: "28rem", padding: 0 }}>
      {isOpen && <FundingEntryForm {...rest} />}
    </ModalContent>
  </Modal>
);

export default FundingEntryModal;
