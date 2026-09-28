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
import { LEDGER_DESCRIPTION_MAX_LENGTH } from "@/components/clientsPage/clientsPage.types";
import { formatCurrency, todayString } from "@/lib/format";

export interface LedgerEntryModalProps {
  isOpen: boolean;
  clientId: number;
  kind: "BILL" | "PAYMENT";
  /** Current outstanding, offered as the default when settling in full. */
  outstanding?: number;
  onClose: () => void;
  onSuccess: () => void;
}

const LedgerEntryForm: React.FC<Omit<LedgerEntryModalProps, "isOpen">> = ({
  clientId,
  kind,
  outstanding = 0,
  onClose,
  onSuccess,
}) => {
  const isBill = kind === "BILL";

  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayString());
  const [invoiceNo, setInvoiceNo] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${clientId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_type: kind,
          amount: Number(amount),
          entry_date: entryDate,
          invoice_no: isBill ? invoiceNo.trim() || null : null,
          period_month: isBill ? periodMonth || null : null,
          payment_method: isBill ? null : paymentMethod || null,
          reference: reference.trim() || null,
          description: description.trim() || null,
        }),
      });
      const json = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(json.error || "Failed to save");
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
        <ModalTitle>{isBill ? "Add Bill" : "Record Payment"}</ModalTitle>
        <ModalDescription>
          {isBill
            ? "A new bill on this client's account. It adds to whatever is already outstanding."
            : "Money received from this client. It comes off their account — it does not have to match any particular bill."}
        </ModalDescription>
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
              inputMode="numeric"
              autoFocus
              disabled={loading}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
            />
            {!isBill && outstanding > 0 && (
              <button
                type="button"
                className="self-start text-xs text-primary hover:underline"
                onClick={() => setAmount(String(outstanding))}
              >
                Settle in full — {formatCurrency(outstanding)}
              </button>
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
          </div>

          {isBill ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="entry-invoice">Invoice No. (optional)</Label>
                <Input
                  id="entry-invoice"
                  disabled={loading}
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="entry-period">Billing Month (optional)</Label>
                <Input
                  id="entry-period"
                  type="month"
                  disabled={loading}
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                />
              </div>
            </>
          ) : (
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
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-reference">Reference</Label>
            <Input
              id="entry-reference"
              disabled={loading}
              placeholder={isBill ? "PO / contract no." : "UTR / cheque no."}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-description">Description</Label>
            <Textarea
              id="entry-description"
              rows={2}
              maxLength={LEDGER_DESCRIPTION_MAX_LENGTH}
              disabled={loading}
              placeholder={isBill ? "e.g. July hire charges" : ""}
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
          {loading ? "Saving..." : isBill ? "Add Bill" : "Record Payment"}
        </Button>
      </ModalFooter>
    </>
  );
};

export const LedgerEntryModal: React.FC<LedgerEntryModalProps> = ({
  isOpen,
  ...rest
}) => (
  <Modal open={isOpen} onOpenChange={(open) => !open && rest.onClose()}>
    <ModalContent style={{ maxWidth: "28rem", padding: 0 }}>
      {isOpen && <LedgerEntryForm {...rest} />}
    </ModalContent>
  </Modal>
);

export default LedgerEntryModal;
