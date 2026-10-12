"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { formatCurrency, formatDate, formatMonth, todayString } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  SALARY_DESCRIPTION_MAX_LENGTH,
  type CreateSalaryEntryPayload,
  type SalaryDriverDetail,
  type SalaryEntry,
  type SalaryEntryType,
  type SetSalaryPayload,
} from "./salariesPage.types";

export interface SalaryDriverModalProps {
  /** Null closes the modal. */
  driverId: number | null;
  /** YYYY-MM — the sheet the modal was opened from. */
  month: string;
  onClose: () => void;
  /** Called after any change, so the sheet behind can reload. */
  onChanged: () => void;
}

const ENTRY_LABEL: Record<SalaryEntryType, string> = {
  ADVANCE: "Advance",
  DEDUCTION: "Deduction",
};

async function send(url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return res.ok ? null : json?.error || "Failed to save";
  } catch {
    return "Network error";
  }
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
    {children}
  </h3>
);

const ErrorNote = ({ message }: { message: string | null }) =>
  message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;

/**
 * One driver's month: how the pay was arrived at, the salary it starts from,
 * and the advances and deductions taken off it. Every figure is the server's;
 * each change here reloads them rather than adjusting them locally.
 */
const SalaryDriverBody: React.FC<
  Omit<SalaryDriverModalProps, "driverId"> & {
    driverId: number;
    /** A save is in flight anywhere in the modal: everything that changes data is locked. */
    busy: boolean;
    onBusyChange: (busy: boolean) => void;
  }
> = ({ driverId, month, onChanged, busy, onBusyChange }) => {
  const [detail, setDetail] = useState<SalaryDriverDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/driver-salaries/${driverId}?month=${month}`, { signal });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load");
        setDetail(json.data as SalaryDriverDetail);
        setLoadError(null);
      } catch (err) {
        // Cancelled because the modal closed or moved to another driver.
        if (signal?.aborted) return;
        setLoadError(err instanceof Error ? err.message : "Network error");
      }
    },
    [driverId, month],
  );

  // The request is cancelled on cleanup, so closing the modal mid-load (or
  // React's dev-mode double mount) never leaves a second one running.
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const afterChange = async () => {
    await load();
    onChanged();
  };

  if (loadError && !detail) {
    return (
      <ModalBody>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </ModalBody>
    );
  }

  if (!detail) {
    return (
      <ModalBody>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </ModalBody>
    );
  }

  const { row } = detail;

  return (
    <>
      <ModalHeader>
        <ModalTitle>{row.name}</ModalTitle>
        <ModalDescription>
          Salary for {formatMonth(month)}
          {detail.is_provisional && " — the month isn't over, so this can still change"}
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="flex flex-col gap-6">
          <PayBreakdown detail={detail} />
          <SalarySection
            detail={detail}
            driverId={driverId}
            month={month}
            onSaved={afterChange}
            busy={busy}
            onBusyChange={onBusyChange}
          />
          <EntriesSection
            detail={detail}
            driverId={driverId}
            month={month}
            onSaved={afterChange}
            busy={busy}
            onBusyChange={onBusyChange}
          />
        </div>
      </ModalBody>
    </>
  );
};

// ─── How the figure was arrived at ───

function PayBreakdown({ detail }: { detail: SalaryDriverDetail }) {
  const { row } = detail;
  const hasSalary = row.monthly_salary != null;

  const line = (label: React.ReactNode, value: React.ReactNode, strong = false) => (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-1.5 text-sm",
        strong && "border-t border-border pt-2.5 text-base font-semibold",
      )}
    >
      <span className={strong ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  );

  return (
    <section className="space-y-2">
      <SectionTitle>Pay this month</SectionTitle>
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-2">
        {line(
          "Monthly salary",
          hasSalary ? <Money value={row.monthly_salary} /> : <span className="text-muted-foreground">Not set</span>,
        )}
        {line(
          <>
            Attendance cut
            <span className="block text-xs">
              {row.unpaid_days} unpaid {row.unpaid_days === 1 ? "day" : "days"} of{" "}
              {detail.days_in_month} ({row.absent_days} absent, {row.leave_days} leave)
            </span>
          </>,
          hasSalary ? <>− <Money value={row.attendance_cut} /></> : "—",
        )}
        {line("Advances", <>− <Money value={row.advances} /></>)}
        {line("Other deductions", <>− <Money value={row.deductions} /></>)}
        {line(
          "Net pay",
          row.net_pay == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <Money value={row.net_pay} tone={row.net_pay < 0 ? "negative" : "neutral"} />
          ),
          true,
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {row.days_present} {row.days_present === 1 ? "day" : "days"} present
        {row.unmarked_days > 0 && (
          <>
            {" · "}
            <span className="font-medium text-warning-subtle-foreground">
              {row.unmarked_days} not marked (paid, not cut)
            </span>
          </>
        )}
      </p>
    </section>
  );
}

// ─── The salary itself, with its history ───

function SalarySection({
  detail,
  driverId,
  month,
  onSaved,
  busy,
  onBusyChange,
}: {
  detail: SalaryDriverDetail;
  driverId: number;
  month: string;
  onSaved: () => Promise<void>;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const current = detail.row.monthly_salary;
  const [editing, setEditing] = useState(current == null);
  const [amount, setAmount] = useState(current != null ? String(current) : "");
  const [fromMonth, setFromMonth] = useState(month);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (amount === "" || Number(amount) < 0) {
      setError("Enter the monthly salary");
      return;
    }
    if (!fromMonth) {
      setError("Choose the month it starts from");
      return;
    }
    // Locked from the click until the sheet behind has reloaded, so a second
    // click can't send it again and nothing else can change the driver
    // half-way through.
    setSaving(true);
    onBusyChange(true);
    setError(null);
    const payload: SetSalaryPayload = {
      monthly_salary: Number(amount),
      effective_month: fromMonth,
    };
    const failure = await send(`/api/driver-salaries/${driverId}/rates`, payload);
    if (failure) {
      setSaving(false);
      onBusyChange(false);
      setError(failure);
      return;
    }
    setEditing(false);
    await onSaved();
    setSaving(false);
    onBusyChange(false);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Monthly salary</SectionTitle>
        {!editing && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setEditing(true)}>
            Change
          </Button>
        )}
      </div>

      {editing && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="salary-amount">Salary (₹ per month)</Label>
              <Input
                id="salary-amount"
                type="number"
                inputMode="numeric"
                min={0}
                disabled={busy}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="salary-from">From month</Label>
              <Input
                id="salary-from"
                type="month"
                disabled={busy}
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Applies from that month onward. Earlier months keep the salary they had.
          </p>
          <ErrorNote message={error} />
          <div className="flex justify-end gap-2">
            {current != null && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button size="sm" disabled={busy} onClick={save}>
              {saving ? "Saving…" : "Save salary"}
            </Button>
          </div>
        </div>
      )}

      {detail.rates.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border text-sm">
          {detail.rates.map((rate) => (
            <li key={rate.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-muted-foreground">
                From {formatMonth(rate.effective_from)}
              </span>
              <Money value={rate.monthly_salary} className="font-medium" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Advances and deductions for the month ───

function EntriesSection({
  detail,
  driverId,
  month,
  onSaved,
  busy,
  onBusyChange,
}: {
  detail: SalaryDriverDetail;
  driverId: number;
  month: string;
  onSaved: () => Promise<void>;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [adding, setAdding] = useState<SalaryEntryType | null>(null);
  const [amount, setAmount] = useState("");
  // An entry for a past month's sheet is dated today by default; the salary
  // month it comes out of is the sheet being looked at.
  const [entryDate, setEntryDate] = useState(todayString());
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReverse, setConfirmReverse] = useState<number | null>(null);
  const [reverseError, setReverseError] = useState<string | null>(null);

  const startAdding = (type: SalaryEntryType) => {
    setAdding(type);
    setAmount("");
    setDescription("");
    setEntryDate(todayString());
    setError(null);
  };

  const save = async () => {
    if (!adding) return;
    if (!amount || Number(amount) <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    setSaving(true);
    onBusyChange(true);
    setError(null);
    const payload: CreateSalaryEntryPayload = {
      entry_type: adding,
      amount: Number(amount),
      entry_date: entryDate,
      period_month: month,
      description: description.trim() || null,
    };
    const failure = await send(`/api/driver-salaries/${driverId}/entries`, payload);
    if (failure) {
      setSaving(false);
      onBusyChange(false);
      setError(failure);
      return;
    }
    setAdding(null);
    await onSaved();
    setSaving(false);
    onBusyChange(false);
  };

  const reverse = async (entry: SalaryEntry) => {
    setSaving(true);
    onBusyChange(true);
    setReverseError(null);
    const failure = await send(
      `/api/driver-salaries/${driverId}/entries/${entry.id}/reverse`,
      {},
    );
    setConfirmReverse(null);
    if (failure) {
      setSaving(false);
      onBusyChange(false);
      setReverseError(failure);
      return;
    }
    await onSaved();
    setSaving(false);
    onBusyChange(false);
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Advances &amp; deductions · {formatMonth(month)}</SectionTitle>
        {!adding && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => startAdding("ADVANCE")}
            >
              Add advance
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => startAdding("DEDUCTION")}
            >
              Add deduction
            </Button>
          </div>
        )}
      </div>

      {adding && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <p className="text-sm font-medium text-foreground">
            {adding === "ADVANCE"
              ? `Advance against ${formatMonth(month)}'s salary`
              : `Deduction from ${formatMonth(month)}'s salary`}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entry-amount">Amount (₹)</Label>
              <Input
                id="entry-amount"
                type="number"
                inputMode="numeric"
                min={1}
                autoFocus
                disabled={busy}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entry-date">{adding === "ADVANCE" ? "Given on" : "Date"}</Label>
              <Input
                id="entry-date"
                type="date"
                max={todayString()}
                disabled={busy}
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-description">Note (optional)</Label>
            <Input
              id="entry-description"
              maxLength={SALARY_DESCRIPTION_MAX_LENGTH}
              disabled={busy}
              placeholder={adding === "ADVANCE" ? "e.g. cash for family function" : "e.g. tyre damage"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <ErrorNote message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setAdding(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={save}>
              {saving ? "Saving…" : adding === "ADVANCE" ? "Record advance" : "Record deduction"}
            </Button>
          </div>
        </div>
      )}

      <ErrorNote message={reverseError} />

      {detail.entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          Nothing taken off this month&apos;s salary.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {detail.entries.map((entry) => {
            // A cancelled entry and the row that cancelled it both stay on
            // record, struck through, and neither counts.
            const dead = entry.is_reversed || entry.is_reversal;
            return (
              <li key={entry.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("font-medium", dead && "text-muted-foreground line-through")}>
                      {ENTRY_LABEL[entry.entry_type]} · {formatCurrency(entry.amount)}
                    </span>
                    {entry.is_reversed && <Badge variant="outline">Reversed</Badge>}
                    {entry.is_reversal && <Badge variant="outline">Reversal</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(entry.entry_date)}
                    {entry.description && ` · ${entry.description}`}
                  </div>
                </div>
                {!dead &&
                  (confirmReverse === entry.id ? (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => setConfirmReverse(null)}
                      >
                        Keep
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        className="text-destructive"
                        onClick={() => void reverse(entry)}
                      >
                        Reverse
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      className="shrink-0 text-muted-foreground"
                      onClick={() => setConfirmReverse(entry.id)}
                    >
                      Reverse
                    </Button>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export const SalaryDriverModal: React.FC<SalaryDriverModalProps> = ({
  driverId,
  ...rest
}) => {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={driverId !== null}
      // Closing mid-save would leave the request running with nothing on
      // screen to say whether it worked, so X, Esc and a click outside wait.
      onOpenChange={(open) => !open && !busy && rest.onClose()}
    >
      <ModalContent style={{ maxWidth: "34rem", padding: 0 }}>
        {/* Keyed so a different driver starts from a clean, loading state. */}
        {driverId !== null && (
          <SalaryDriverBody
            key={driverId}
            driverId={driverId}
            busy={busy}
            onBusyChange={setBusy}
            {...rest}
          />
        )}
      </ModalContent>
    </Modal>
  );
};

export default SalaryDriverModal;
