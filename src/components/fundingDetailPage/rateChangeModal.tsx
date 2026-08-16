"use client";

import React, { useState } from "react";
import { SaveIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/loadingSpinner";
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
import { ROI_BASES, type InterestMode } from "@/components/loansPage/loansPage.types";
import { todayString } from "@/lib/format";

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
  const [roi, setRoi] = useState("");
  const [roiBasis, setRoiBasis] = useState("MONTHLY");
  const [fixedAmount, setFixedAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayString());
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPercent = interestMode === "PERCENT";

  const handleSubmit = async () => {
    if (isPercent && (!roi || Number(roi) < 0)) {
      setError("Enter the new rate");
      return;
    }
    if (!isPercent && (!fixedAmount || Number(fixedAmount) < 0)) {
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
          roi: isPercent ? Number(roi) : null,
          roi_basis: isPercent ? roiBasis : null,
          fixed_interest_amount: isPercent ? null : Number(fixedAmount),
          effective_from: effectiveFrom,
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="rate-roi">
                  New Rate (%) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rate-roi"
                  type="number"
                  step="0.01"
                  autoFocus
                  disabled={loading}
                  value={roi}
                  onChange={(e) => {
                    setRoi(e.target.value);
                    setError(null);
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rate-basis">Per</Label>
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
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="rate-fixed">
                New Monthly Interest (₹) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rate-fixed"
                type="number"
                autoFocus
                disabled={loading}
                value={fixedAmount}
                onChange={(e) => {
                  setFixedAmount(e.target.value);
                  setError(null);
                }}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="rate-from">
              Effective From <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rate-from"
              type="date"
              disabled={loading}
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rate-note">Note</Label>
            <Input
              id="rate-note"
              disabled={loading}
              placeholder="e.g. renegotiated over the phone"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
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
