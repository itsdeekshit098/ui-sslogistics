"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangleIcon } from "@/components/ui/icon";
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
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { addMonths } from "@/lib/dateOnly";
import { formatCurrency, formatDate, formatMonth, todayString } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  SALARY_DESCRIPTION_MAX_LENGTH,
  type CreateSalaryEntryPayload,
  type SalaryDriverDetail,
  type SalaryEntry,
  type SalaryEntryType,
  type SettleSalaryPayload,
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
        <ModalDescription>{formatMonth(month)}</ModalDescription>
      </ModalHeader>

      <PayHero detail={detail} />

      <ModalBody>
        <div className="flex flex-col gap-5">
          <SettlementSection
            detail={detail}
            driverId={driverId}
            month={month}
            onSaved={afterChange}
            busy={busy}
            onBusyChange={onBusyChange}
          />
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

// ─── The one number that matters, up top ───

function PayHero({ detail }: { detail: SalaryDriverDetail }) {
  const { row, settlement } = detail;
  const hasSalary = row.monthly_salary != null;

  return (
    <div className="border-b border-border bg-gradient-to-b from-primary/[0.06] to-transparent px-6 pb-5 pt-1">
      {settlement ? (
        <p className="text-sm text-muted-foreground">
          Settled on {formatDate(settlement.created_at)}
        </p>
      ) : null}
      <p className="mt-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {settlement ? "Paid" : "Net pay"}
      </p>
      <div className="mt-1 flex items-baseline gap-3">
        {hasSalary ? (
          <Money
            value={settlement ? settlement.amount_paid : row.net_pay}
            tone={!settlement && (row.net_pay ?? 0) < 0 ? "negative" : "neutral"}
            className="text-[2.25rem] font-extrabold leading-none tracking-tight"
          />
        ) : (
          <span className="text-[1.5rem] font-semibold text-muted-foreground">
            Salary not set
          </span>
        )}
        {hasSalary && (
          <Badge variant={settlement ? "success-subtle" : "warning-subtle"} className="mb-1">
            {settlement ? "✓ Paid" : "Unsettled"}
          </Badge>
        )}
      </div>
      {detail.is_provisional && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warning-subtle-foreground">
          <AlertTriangleIcon size={13} className="shrink-0" />
          Month isn&apos;t over — absences or advances can still change this
        </p>
      )}
    </div>
  );
}

// ─── How the figure was arrived at — secondary detail, collapsed once settled ───

function PayBreakdown({ detail }: { detail: SalaryDriverDetail }) {
  const { row, settlement } = detail;
  const hasSalary = row.monthly_salary != null;

  const line = (label: React.ReactNode, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  );

  return (
    <details className="group rounded-xl border border-border" open={!settlement}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
        How this was calculated
        <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-border px-4 py-1">
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
        {row.carry_forward_in !== 0 &&
          line(
            <span className="text-warning-subtle-foreground">
              {row.carry_forward_in > 0 ? "Carried from last month" : "Owed from last month"}
              <span className="block text-xs opacity-80">
                {row.carry_forward_in > 0
                  ? "Last month's overpayment, already counted in advances above"
                  : "Last month's shortfall, already counted in deductions above"}
              </span>
            </span>,
            <Money
              value={Math.abs(row.carry_forward_in)}
              className="text-warning-subtle-foreground"
            />,
          )}
      </div>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
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
    </details>
  );
}

// ─── Closing out the month: what was actually paid ───

function SettlementSection({
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
  const { row, settlement } = detail;
  const netPay = row.net_pay ?? 0;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(netPay));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);

  const startSettling = () => {
    setAmount(String(netPay));
    setNote("");
    setError(null);
    setOpen(true);
  };

  const paid = amount === "" ? null : Number(amount);
  const gap = paid != null && !Number.isNaN(paid) ? paid - netPay : null;

  const save = async () => {
    if (amount === "" || Number(amount) < 0 || Number.isNaN(Number(amount))) {
      setError("Enter the amount actually paid");
      return;
    }
    setSaving(true);
    onBusyChange(true);
    setError(null);
    const payload: SettleSalaryPayload = {
      period_month: month,
      amount_paid: Number(amount),
      note: note.trim() || null,
    };
    const failure = await send(`/api/driver-salaries/${driverId}/settle`, payload);
    if (failure) {
      setSaving(false);
      onBusyChange(false);
      setError(failure);
      return;
    }
    setOpen(false);
    await onSaved();
    setSaving(false);
    onBusyChange(false);
  };

  const undo = async () => {
    if (!settlement) return;
    setSaving(true);
    onBusyChange(true);
    setUndoError(null);
    try {
      const res = await fetch(`/api/driver-salaries/${driverId}/settle/${settlement.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setSaving(false);
        onBusyChange(false);
        setConfirmUndo(false);
        setUndoError(json?.error || "Failed to undo");
        return;
      }
    } catch {
      setSaving(false);
      onBusyChange(false);
      setConfirmUndo(false);
      setUndoError("Network error");
      return;
    }
    setConfirmUndo(false);
    await onSaved();
    setSaving(false);
    onBusyChange(false);
  };

  if (settlement) {
    // The hero already shows "Paid ✓" and the amount; this is just the
    // carry-forward explanation (when there is one) and the one way back out.
    if (settlement.carry_forward === 0 && !settlement.note) {
      return (
        <div className="flex justify-end">
          <ErrorNote message={undoError} />
          {confirmUndo ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Undo this settlement?</span>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmUndo(false)}>
                Keep
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                className="text-destructive"
                onClick={() => void undo()}
              >
                {saving ? "Undoing…" : "Undo"}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              className="text-muted-foreground"
              onClick={() => setConfirmUndo(true)}
            >
              Undo settlement
            </Button>
          )}
        </div>
      );
    }
    return (
      <section className="space-y-2">
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            settlement.carry_forward !== 0
              ? "border-warning/40 bg-warning-subtle"
              : "border-border bg-muted/40",
          )}
        >
          {settlement.carry_forward !== 0 && (
            <p className="font-medium text-warning-subtle-foreground">
              {settlement.carry_forward > 0
                ? `Overpaid by ${formatCurrency(Math.abs(settlement.carry_forward))}`
                : `Paid ${formatCurrency(Math.abs(settlement.carry_forward))} short`}
            </p>
          )}
          {settlement.carry_forward !== 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {settlement.carry_forward > 0
                ? `Carried forward to ${formatMonth(addMonths(month, 1))} as an advance against next month's pay.`
                : `Carried forward to ${formatMonth(addMonths(month, 1))} as a deduction from next month's pay.`}
            </p>
          )}
          {settlement.note && (
            <p
              className={cn(
                "text-xs text-muted-foreground",
                settlement.carry_forward !== 0 && "mt-1.5 border-t border-warning/30 pt-1.5",
              )}
            >
              {settlement.note}
            </p>
          )}
        </div>
        <ErrorNote message={undoError} />
        <div className="flex justify-end">
          {confirmUndo ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Undo this settlement and any carry-forward it created?
              </span>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmUndo(false)}>
                Keep
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                className="text-destructive"
                onClick={() => void undo()}
              >
                {saving ? "Undoing…" : "Undo"}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              className="text-muted-foreground"
              onClick={() => setConfirmUndo(true)}
            >
              Undo settlement
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2.5">
      {open ? (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <p className="text-sm font-medium text-foreground">
            Settle {formatMonth(month)}&apos;s pay
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settle-amount">Amount actually paid (₹)</Label>
            <Input
              id="settle-amount"
              type="number"
              inputMode="numeric"
              min={0}
              autoFocus
              disabled={busy}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
            />
          </div>
          {gap != null && gap !== 0 && (
            <p
              className={cn(
                "rounded-lg px-2.5 py-2 text-xs",
                gap > 0
                  ? "bg-warning-subtle text-warning-subtle-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {gap > 0
                ? `You're paying ${formatCurrency(gap)} more than owed — that will carry forward to ${formatMonth(addMonths(month, 1))} as an advance against next month's pay.`
                : `You're paying ${formatCurrency(Math.abs(gap))} less than owed — that will carry forward to ${formatMonth(addMonths(month, 1))} as a deduction from next month's pay.`}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settle-note">Note (optional)</Label>
            <Input
              id="settle-note"
              maxLength={SALARY_DESCRIPTION_MAX_LENGTH}
              disabled={busy}
              placeholder="e.g. paid full amount in cash"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <ErrorNote message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={save}>
              {saving ? "Saving…" : "Confirm paid"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Button
            className="w-full"
            disabled={busy || row.monthly_salary == null}
            onClick={startSettling}
          >
            Mark paid
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {row.monthly_salary == null
              ? "Set a salary before settling this month."
              : "Record what was actually handed over — any gap carries to next month automatically."}
          </p>
        </>
      )}
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
              <li
                key={entry.id}
                className={cn(
                  "flex items-start gap-3 px-3 py-2.5 text-sm",
                  entry.is_carry_forward && !dead && "bg-warning-subtle/40",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("font-medium", dead && "text-muted-foreground line-through")}>
                      {ENTRY_LABEL[entry.entry_type]} · {formatCurrency(entry.amount)}
                    </span>
                    {entry.is_carry_forward && (
                      <Badge variant="warning-subtle">Carried in</Badge>
                    )}
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
