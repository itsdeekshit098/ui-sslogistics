"use client";

import React, { useState } from "react";
import { SaveIcon } from "@ui/icons";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { FormField } from "@ui/components/formField";
import { Alert } from "@ui/components/alert";
import { DatePicker } from "@ui/components/datePicker";
import { MoneyInput } from "@ui/components/moneyInput";
import { NumberInput } from "@ui/components/numberInput";
import { Spinner } from "@ui/components/spinner";
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
import { ROI_BASES, type InterestMode } from "@/components/loansPage/loansPage.types";
import { todayInIndia } from "@/lib/dateOnly";

export interface RateChangeModalProps {
  isOpen: boolean;
  fundingId: number;
  interestMode: InterestMode;
  onClose: () => void;
  onSuccess: () => void;
}

const RateChangeForm: React.FC<Omit<RateChangeModalProps, "isOpen">> = ({
  fundingId,
  interestMode,
  onClose,
  onSuccess,
}) => {
  const [roi, setRoi] = useState<number | null>(null);
  const [roiBasis, setRoiBasis] = useState("MONTHLY");
  const [fixedAmount, setFixedAmount] = useState<number | null>(null);
  // The business day in India: the UTC date is still "yesterday" until 05:30.
  const today = todayInIndia();
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(today);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPercent = interestMode === "PERCENT";

  const handleSubmit = async () => {
    if (isPercent && (roi == null || roi < 0)) {
      setError("Enter the new rate");
      return;
    }
    if (!isPercent && (fixedAmount == null || fixedAmount < 0)) {
      setError("Enter the new monthly amount");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/fundings/${fundingId}/rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roi: isPercent ? roi : null,
          roi_basis: isPercent ? roiBasis : null,
          fixed_interest_amount: isPercent ? null : fixedAmount,
          effective_from: effectiveFrom ?? today,
          note: note.trim() || null,
        }),
      });
      const json = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(json.error || "Failed to record rate change");
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
        <ModalTitle>Change Rate</ModalTitle>
        <ModalDescription>
          Records a renegotiated rate from a given date. Interest already accrued
          at the old rate stays as it is — only days from the effective date
          onward are charged at the new one.
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="flex flex-col gap-4">
          {isPercent ? (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="New Rate (%)" required>
                {(control) => (
                  <NumberInput
                    {...control}
                    autoFocus
                    min={0}
                    maxDecimals={2}
                    step={0.01}
                    disabled={loading}
                    value={roi}
                    onValueChange={(v) => {
                      setRoi(v);
                      setError(null);
                    }}
                  />
                )}
              </FormField>
              <FormField label="Per" htmlFor="rate-basis">
                <Select disabled={loading} value={roiBasis} onValueChange={setRoiBasis}>
                  <SelectTrigger id="rate-basis">
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
            </div>
          ) : (
            <FormField label="New Monthly Interest (₹)" required>
              {(control) => (
                <MoneyInput
                  {...control}
                  autoFocus
                  min={0}
                  disabled={loading}
                  value={fixedAmount}
                  onValueChange={(v) => {
                    setFixedAmount(v);
                    setError(null);
                  }}
                />
              )}
            </FormField>
          )}

          <FormField label="Effective From" required>
            {(control) => (
              <DatePicker
                {...control}
                today={today}
                disabled={loading}
                value={effectiveFrom}
                onValueChange={setEffectiveFrom}
              />
            )}
          </FormField>

          <FormField label="Note">
            {(control) => (
              <Input
                {...control}
                disabled={loading}
                placeholder="e.g. renegotiated over the phone"
                value={note}
                onChange={(e) => setNote(e.target.value)}
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
          {loading ? "Saving..." : "Save Rate"}
        </Button>
      </ModalFooter>
    </>
  );
};

export const RateChangeModal: React.FC<RateChangeModalProps> = ({ isOpen, ...rest }) => (
  <Modal open={isOpen} onOpenChange={(open) => !open && rest.onClose()}>
    <ModalContent style={{ maxWidth: "26rem", padding: 0 }}>
      {isOpen && <RateChangeForm {...rest} />}
    </ModalContent>
  </Modal>
);

export default RateChangeModal;
