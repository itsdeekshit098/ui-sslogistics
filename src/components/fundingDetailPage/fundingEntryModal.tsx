"use client";

import React, { useState } from "react";
import { SaveIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LookupSelect } from "@/components/lookupSelect";
import { LoadingSpinner } from "@/components/loadingSpinner";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import type { FundingDirection, FundingEntryType } from "@/components/loansPage/loansPage.types";
import { formatCurrencyPrecise, todayString } from "@/lib/format";

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
  const [amount, setAmount] = useState(
    suggestedAmount && suggestedAmount > 0 ? String(suggestedAmount.toFixed(2)) : "",
  );
  const [entryDate, setEntryDate] = useState(todayString());
  const [paymentMethod, setPaymentMethod] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[direction][entryType];

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
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
          amount: Number(amount),
          entry_date: entryDate,
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-amount">
              Amount (₹) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="entry-amount"
              type="number"
              step="0.01"
              autoFocus
              disabled={loading}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
            />
            {suggestedAmount != null && suggestedAmount > 0 && (
              <span className="text-xs text-muted-foreground">
                Suggested: {formatCurrencyPrecise(suggestedAmount)}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-date">Date</Label>
            <Input
              id="entry-date"
              type="date"
              disabled={loading}
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Backdating is fine — interest is recalculated from scratch, so the
              figures land where they should.
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-method">Payment Method</Label>
            <LookupSelect
              id="entry-method"
              category="payment_method"
              addLabel="payment method"
              placeholder="Select method"
              value={paymentMethod}
              onValueChange={setPaymentMethod}
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-reference">Reference</Label>
            <Input
              id="entry-reference"
              disabled={loading}
              placeholder="UTR / cheque no."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-description">Description</Label>
            <Textarea
              id="entry-description"
              rows={2}
              maxLength={300}
              disabled={loading}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <LoadingSpinner size="sm" className="mr-2" />
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
