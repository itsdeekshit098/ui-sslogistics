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
import type {
  LoanInstallment,
  PaymentType,
} from "@/components/loansPage/loansPage.types";
import { formatCurrency, formatDate, todayString } from "@/lib/format";

export interface LoanPaymentModalProps {
  isOpen: boolean;
  loanId: number;
  paymentType: PaymentType;
  /** Set when settling a specific scheduled EMI. */
  installment?: LoanInstallment | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TITLES: Record<PaymentType, { title: string; description: string }> = {
  EMI: {
    title: "Mark EMI Paid",
    description: "Record that this scheduled installment has been paid.",
  },
  PREPAYMENT: {
    title: "Record Prepayment",
    description:
      "Money paid over and above the schedule. It reduces the outstanding without changing the installment dates.",
  },
  FORECLOSURE: {
    title: "Record Foreclosure",
    description: "A lump sum closing the loan ahead of its schedule.",
  },
  CHARGE: {
    title: "Record Charge",
    description:
      "A bounce fee or penalty. Reported separately and never reduces the outstanding.",
  },
  ADJUSTMENT: {
    title: "Record Adjustment",
    description: "An agreed correction to what is owed.",
  },
};

const LoanPaymentForm: React.FC<Omit<LoanPaymentModalProps, "isOpen">> = ({
  loanId,
  paymentType,
  installment,
  onClose,
  onSuccess,
}) => {
  // Prefilled with exactly what's still due, which is the answer in almost
  // every case — the field stays editable for a part payment.
  const [amount, setAmount] = useState(
    installment ? String(installment.amount_remaining) : "",
  );
  const [paidOn, setPaidOn] = useState(todayString());
  const [paymentMethod, setPaymentMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = TITLES[paymentType];

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/loans/${loanId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_type: paymentType,
          installment_id: installment?.id ?? null,
          amount: Number(amount),
          paid_on: paidOn,
          payment_method: paymentMethod || null,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(json.error || "Failed to record payment");
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
        {installment && (
          <div className="mb-4 rounded-xl border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Installment</span>
              <span className="font-medium">#{installment.installment_no}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due</span>
              <span>{formatDate(installment.due_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Still due</span>
              <span className="font-medium">
                {formatCurrency(installment.amount_remaining)}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-amount">
              Amount (₹) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="payment-amount"
              type="number"
              inputMode="numeric"
              autoFocus
              disabled={loading}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-date">Paid On</Label>
            <Input
              id="payment-date"
              type="date"
              disabled={loading}
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <LookupSelect
              id="payment-method"
              category="payment_method"
              addLabel="payment method"
              placeholder="Select method"
              value={paymentMethod}
              onValueChange={setPaymentMethod}
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-reference">Reference</Label>
            <Input
              id="payment-reference"
              disabled={loading}
              placeholder="UTR / cheque no."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-notes">Notes</Label>
            <Textarea
              id="payment-notes"
              rows={2}
              maxLength={500}
              disabled={loading}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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

export const LoanPaymentModal: React.FC<LoanPaymentModalProps> = ({
  isOpen,
  ...rest
}) => (
  <Modal open={isOpen} onOpenChange={(open) => !open && rest.onClose()}>
    <ModalContent style={{ maxWidth: "28rem", padding: 0 }}>
      {isOpen && <LoanPaymentForm {...rest} />}
    </ModalContent>
  </Modal>
);

export default LoanPaymentModal;
