"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { formatMonth, todayString } from "@/lib/format";
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
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayString());
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!amount || Number(amount) <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: CreateSalaryEntryPayload = {
      entry_type: "ADVANCE",
      amount: Number(amount),
      entry_date: entryDate,
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="advance-amount">Amount (₹)</Label>
                <Input
                  id="advance-amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  autoFocus
                  placeholder="Enter amount"
                  disabled={saving}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="advance-date">Given on</Label>
                <Input
                  id="advance-date"
                  type="date"
                  max={todayString()}
                  disabled={saving}
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="advance-description">Note (optional)</Label>
              <Input
                id="advance-description"
                maxLength={SALARY_DESCRIPTION_MAX_LENGTH}
                disabled={saving}
                placeholder="e.g. cash for family function"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
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
