"use client";

import React, { useState } from "react";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { FormField } from "@ui/components/formField";
import { DatePicker } from "@ui/components/datePicker";
import { MoneyInput } from "@ui/components/moneyInput";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@ui/components/modal";
import { formatMonth } from "@/lib/format";
import { todayInIndia } from "@/lib/dateOnly";
import {
  SALARY_DESCRIPTION_MAX_LENGTH,
  type CreateSalaryEntryPayload,
} from "./salariesPage.types";

export interface AddAdvanceModalProps {
  driverId: number;
  driverName: string;
  /** YYYY-MM — the sheet the modal was opened from; the entry comes out of this month. */
  month: string;
  onClose: () => void;
  /** Called after a successful save, so the sheet behind can reload. */
  onSaved: () => void;
}

/**
 * A fast path for the one most-used salary action: recording an advance
 * against a driver, right from their row, without opening the full
 * SalaryDriverModal (salary rate history, attendance breakdown, entries list).
 */
export const AddAdvanceModal: React.FC<AddAdvanceModalProps> = ({
  driverId,
  driverName,
  month,
  onClose,
  onSaved,
}) => {
  const [amount, setAmount] = useState<number | null>(null);
  // The business day in India: the UTC date is still "yesterday" until 05:30.
  const today = todayInIndia();
  const [entryDate, setEntryDate] = useState<string | null>(today);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (amount == null || amount <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: CreateSalaryEntryPayload = {
      entry_type: "ADVANCE",
      amount,
      entry_date: entryDate ?? today,
      period_month: month,
      description: description.trim() || null,
    };
    try {
      const res = await fetch(`/api/driver-salaries/${driverId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error || "Failed to save");
        setSaving(false);
        return;
      }
    } catch {
      setError("Network error");
      setSaving(false);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal open onOpenChange={(open) => !open && !saving && onClose()}>
      <ModalContent style={{ maxWidth: "24rem" }}>
        <ModalHeader>
          <ModalTitle>Add advance — {driverName}</ModalTitle>
          <ModalDescription>Against {formatMonth(month)}&apos;s salary</ModalDescription>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Amount (₹)">
                {(control) => (
                  <MoneyInput
                    {...control}
                    min={0}
                    autoFocus
                    placeholder="Enter amount"
                    disabled={saving}
                    value={amount}
                    onValueChange={(v) => {
                      setAmount(v);
                      setError(null);
                    }}
                  />
                )}
              </FormField>
              <FormField label="Given on">
                {(control) => (
                  <DatePicker
                    {...control}
                    today={today}
                    max={today}
                    disabled={saving}
                    value={entryDate}
                    onValueChange={setEntryDate}
                  />
                )}
              </FormField>
            </div>
            <FormField label="Note (optional)">
              {(control) => (
                <Input
                  {...control}
                  maxLength={SALARY_DESCRIPTION_MAX_LENGTH}
                  disabled={saving}
                  placeholder="e.g. cash for family function"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              )}
            </FormField>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Record advance"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddAdvanceModal;
