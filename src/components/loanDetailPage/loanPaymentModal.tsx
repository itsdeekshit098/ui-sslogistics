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
import type {
  LoanInstallment,
  PaymentType,
} from "@/components/loansPage/loansPage.types";
import { formatCurrency, formatDate } from "@/lib/format";
import { todayInIndia } from "@/lib/dateOnly";

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
  const [amount, setAmount] = useState<number | null>(
    installment ? installment.amount_remaining : null,
  );
  // The business day in India: the UTC date is still "yesterday" until 05:30.
  const today = todayInIndia();
  const [paidOn, setPaidOn] = useState<string | null>(today);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = TITLES[paymentType];

  const handleSubmit = async () => {
    if (amount == null || amount <= 0) {
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
          amount,
          paid_on: paidOn ?? today,
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
          <FormField label="Amount (₹)" required>
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

          <FormField label="Paid On">
            {(control) => (
              <DatePicker
                {...control}
                today={today}
                max={today}
                disabled={loading}
                value={paidOn}
                onValueChange={setPaidOn}
              />
            )}
          </FormField>

          <FormField label="Payment Method" htmlFor="payment-method">
            <LookupSelect
              id="payment-method"
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

          <FormField label="Notes">
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                maxLength={500}
                disabled={loading}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
