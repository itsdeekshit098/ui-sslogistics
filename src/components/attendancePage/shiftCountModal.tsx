"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  shiftsFor,
  type DriverShiftCount,
  type ShiftCount,
  type SetShiftCountPayload,
} from "./attendancePage.types";

export interface ShiftCountModalProps {
  /** Null closes the modal. */
  driver: { driver_id: number; name: string; shift_count: ShiftCount } | null;
  /** YYYY-MM the attendance screen is on — the change defaults to this month. */
  month: string;
  onClose: () => void;
  /** Called after a successful save, so the day and month reload. */
  onSaved: () => void;
}

const OPTIONS: ShiftCount[] = [1, 2, 3];

/**
 * How many shifts one driver runs in a day.
 *
 * A change applies from a whole month onward and earlier months keep the
 * count they were marked against, so correcting someone's duties never
 * rewrites a register that has already been paid against.
 */
export function ShiftCountModal({ driver, month, onClose, onSaved }: ShiftCountModalProps) {
  const [count, setCount] = useState<ShiftCount>(driver?.shift_count ?? 3);
  const [fromMonth, setFromMonth] = useState(month);
  const [history, setHistory] = useState<DriverShiftCount[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const driverId = driver?.driver_id ?? null;

  useEffect(() => {
    setCount(driver?.shift_count ?? 3);
    setFromMonth(month);
    setError(null);
    setHistory(null);
  }, [driver?.shift_count, driverId, month]);

  const loadHistory = useCallback(async (id: number, signal: AbortSignal) => {
    try {
      const res = await fetch(`/api/driver-attendance/shift-counts/${id}`, { signal });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) setHistory(json.data.counts as DriverShiftCount[]);
      else setHistory([]);
    } catch {
      if (!signal.aborted) setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (driverId === null) return;
    const controller = new AbortController();
    void loadHistory(driverId, controller.signal);
    return () => controller.abort();
  }, [driverId, loadHistory]);

  const save = async () => {
    if (driverId === null) return;
    if (!fromMonth) {
      setError("Choose the month it starts from");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: SetShiftCountPayload = { shift_count: count, effective_month: fromMonth };
    try {
      const res = await fetch(`/api/driver-attendance/shift-counts/${driverId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setSaving(false);
        setError(json?.error || "Failed to save");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setSaving(false);
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={driver !== null}
      onOpenChange={(open) => !open && !saving && onClose()}
    >
      <ModalContent style={{ maxWidth: "30rem" }}>
        <ModalHeader>
          <ModalTitle>{driver?.name}</ModalTitle>
          <ModalDescription>
            How many shifts this driver runs in a day. A full day — and full pay — is all of
            them.
          </ModalDescription>
        </ModalHeader>

        <ModalBody>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Shifts per day</Label>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Shifts per day">
                {OPTIONS.map((option) => {
                  const active = count === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={saving}
                      onClick={() => setCount(option)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 transition-colors disabled:opacity-60",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <span className="text-lg font-bold tabular-nums">{option}</span>
                      <span className="text-xs font-semibold">
                        {shiftsFor(option).join(" · ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shift-count-from">From month</Label>
              <Input
                id="shift-count-from"
                type="month"
                value={fromMonth}
                disabled={saving}
                onChange={(e) => setFromMonth(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Applies from that month onward. Earlier months keep the shifts they were marked
                against.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {history === null ? (
              <div className="flex justify-center py-2">
                <LoadingSpinner />
              </div>
            ) : history.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  History
                </span>
                <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                  {history.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-muted-foreground">
                        From {formatMonth(row.effective_from)}
                      </span>
                      <span className="font-medium">
                        {row.shift_count} ({shiftsFor(row.shift_count).join(" · ")})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nothing set yet — this driver runs all three shifts.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default ShiftCountModal;
