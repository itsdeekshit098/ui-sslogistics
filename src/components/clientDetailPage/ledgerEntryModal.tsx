"use client";

import React, { useState } from "react";
import { SaveIcon } from "@ui/icons";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { FormField } from "@ui/components/formField";
import { Alert } from "@ui/components/alert";
import { DatePicker } from "@ui/components/datePicker";
import { MonthPicker } from "@ui/components/monthPicker";
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
import { LEDGER_DESCRIPTION_MAX_LENGTH } from "@/components/clientsPage/clientsPage.types";
import { formatCurrency } from "@/lib/format";
import { todayInIndia } from "@/lib/dateOnly";

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

  const [amount, setAmount] = useState<number | null>(null);
  // The business day in India: the UTC date is still "yesterday" until 05:30.
  const today = todayInIndia();
  const [entryDate, setEntryDate] = useState<string | null>(today);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [periodMonth, setPeriodMonth] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (amount == null || amount <= 0) {
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
          amount,
          entry_date: entryDate ?? today,
          invoice_no: isBill ? invoiceNo.trim() || null : null,
          period_month: isBill ? periodMonth : null,
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
          <FormField label="Amount (₹)" required>
            {(control) => (
              <>
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
                {!isBill && outstanding > 0 && (
                  <button
                    type="button"
                    className="self-start text-xs text-primary hover:underline"
                    onClick={() => setAmount(outstanding)}
                  >
                    Settle in full — {formatCurrency(outstanding)}
                  </button>
                )}
              </>
            )}
          </FormField>

          <FormField label="Date">
            {(control) => (
              <DatePicker
                {...control}
                today={today}
                max={today}
                disabled={loading}
                value={entryDate}
                onValueChange={setEntryDate}
              />
            )}
          </FormField>

          {isBill ? (
            <>
              <FormField label="Invoice No. (optional)">
                {(control) => (
                  <Input
                    {...control}
                    disabled={loading}
                    maxLength={100}
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                  />
                )}
              </FormField>

              <FormField label="Billing Month (optional)">
                {(control) => (
                  <MonthPicker
                    {...control}
                    currentMonth={today.slice(0, 7)}
                    clearable
                    disabled={loading}
                    value={periodMonth}
                    onValueChange={setPeriodMonth}
                  />
                )}
              </FormField>
            </>
          ) : (
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
          )}

          <FormField label="Reference">
            {(control) => (
              <Input
                {...control}
                disabled={loading}
                placeholder={isBill ? "PO / contract no." : "UTR / cheque no."}
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
                maxLength={LEDGER_DESCRIPTION_MAX_LENGTH}
                disabled={loading}
                placeholder={isBill ? "e.g. July hire charges" : ""}
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
