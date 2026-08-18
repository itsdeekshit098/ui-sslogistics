"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  CheckCircleIcon,
  UndoIcon,
  ReceiptIcon,
  HandCoinsIcon,
  AlertTriangleIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { isAdmin as isAdminRole } from "@/lib/routePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/statCard";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { BusyOverlay } from "@/components/busyOverlay";
import { ErrorState } from "@/components/errorState";
import { PageHeader } from "@/components/ui/pageHeader";
import { Money } from "@/components/ui/money";
import { DataTable } from "@/components/ui/dataTable/dataTable";
import type { ColumnDef } from "@/components/ui/dataTable/dataTable.types";
import { LoanPaymentModal } from "./loanPaymentModal";
import {
  getLoanStatusLabel,
  getPaymentTypeLabel,
  type Loan,
  type LoanBalance,
  type LoanInstallment,
  type LoanPayment,
  type PaymentType,
} from "@/components/loansPage/loansPage.types";
import {
  formatBankAccountLabel,
  getMandateTypeLabel,
} from "@/components/bankAccountsPage/bankAccountsPage.types";
import {
  flatRoiFromSchedule,
  INSTALLMENT_STATUS_LABELS,
  installmentStatusVariant,
  progressPercent,
  relativeDueLabel,
} from "@/components/loansPage/loansPage.utils";
import { formatCurrency, formatDate } from "@/lib/format";

const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);

const TABS = [
  { key: "schedule", label: "Schedule" },
  { key: "payments", label: "Payments" },
];

export function LoanDetailPage({ loanId }: { loanId: number }) {
  const { userRole, loading: authLoading } = useAuth();
  const canManage = isAdminRole(userRole);

  const [loan, setLoan] = useState<Loan | null>(null);
  const [balance, setBalance] = useState<LoanBalance | null>(null);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [activeTab, setActiveTab] = useState("schedule");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [paymentModal, setPaymentModal] = useState<{
    type: PaymentType;
    installment: LoanInstallment | null;
  } | null>(null);

  const [reverseTarget, setReverseTarget] = useState<LoanPayment | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);

  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);

  const fetchLoan = useCallback(async () => {
    try {
      setFetching(true);
      setError(null);

      const res = await fetch(`/api/loans/${loanId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load loan");

      setLoan(json.data.loan);
      setBalance(json.data.balance);
      setInstallments(json.data.installments ?? []);
      setPayments(json.data.payments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setFetching(false);
    }
  }, [loanId]);

  useEffect(() => {
    if (!authLoading) void fetchLoan();
  }, [authLoading, fetchLoan]);

  /** Flags an installment bounced or waived; passing null clears the flag. */
  const setManualStatus = async (
    installment: LoanInstallment,
    status: "WAIVED" | "BOUNCED" | null,
  ) => {
    setStatusBusyId(installment.id);
    try {
      const res = await fetch(`/api/loans/${loanId}/payments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installment_id: installment.id, manual_status: status }),
      });
      if (res.ok) await fetchLoan();
      else {
        const json = await res.json();
        setError(json.error || "Failed to update installment");
      }
    } catch {
      setError("Network error");
    } finally {
      setStatusBusyId(null);
    }
  };

  const handleReverse = async () => {
    if (!reverseTarget) return;
    setReverseLoading(true);
    setReverseError(null);
    try {
      const res = await fetch(
        `/api/loans/${loanId}/payments/${reverseTarget.id}/reverse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const json = await res.json();
        setReverseError(json.error || "Failed to reverse");
        return;
      }
      setReverseTarget(null);
      await fetchLoan();
    } catch {
      setReverseError("Network error");
    } finally {
      setReverseLoading(false);
    }
  };

  if (authLoading || (fetching && !loan)) {
    return <PageLoadingSkeleton variant="admin" />;
  }

  if (error && !loan) {
    return <ErrorState title="Couldn't load loan" description={error} onRetry={fetchLoan} />;
  }

  if (!loan || !balance) return null;

  const collateral = loan.vehicles?.vehicle_number ?? loan.collateral_description;
  // Recording a payment refetches the whole loan; the page stays up, so the
  // figures and the schedule say they are being refreshed rather than sitting
  // silently on the pre-payment numbers.
  const refreshing = fetching;

  // Hover/focus-revealed, like DataTable's built-in row actions — a fresh
  // 60-installment schedule would otherwise show a "Mark Paid" button on
  // every single row at once.
  const rowActionsClass =
    "flex items-center justify-end gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";

  const scheduleColumns: ColumnDef<LoanInstallment>[] = [
    {
      key: "no",
      header: "#",
      width: 40,
      cell: (installment) => (
        <span className="text-muted-foreground">{installment.installment_no}</span>
      ),
    },
    {
      key: "due_date",
      header: "Due Date",
      cell: (installment) => {
        const settled =
          installment.status === "PAID" || installment.status === "WAIVED";
        return (
          <div className="flex flex-col">
            <span>{formatDate(installment.due_date)}</span>
            {!settled && (
              <span
                className={
                  installment.status === "OVERDUE" || installment.status === "BOUNCED"
                    ? "text-xs text-destructive"
                    : "text-xs text-muted-foreground"
                }
              >
                {relativeDueLabel(installment.due_date)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "amount_due",
      header: "Amount",
      align: "right",
      cell: (installment) => <Money value={installment.amount_due} />,
    },
    {
      key: "amount_paid",
      header: "Paid",
      align: "right",
      cell: (installment) =>
        installment.amount_paid > 0 ? (
          <Money value={installment.amount_paid} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (installment) => (
        <Badge variant={installmentStatusVariant(installment.status)} dot>
          {INSTALLMENT_STATUS_LABELS[installment.status]}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "action",
            header: "Action",
            align: "right" as const,
            cell: (installment: LoanInstallment) => {
              const settled =
                installment.status === "PAID" || installment.status === "WAIVED";
              return (
                <div className={rowActionsClass}>
                  {!settled && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusBusyId === installment.id}
                      onClick={() => setPaymentModal({ type: "EMI", installment })}
                    >
                      Mark Paid
                    </Button>
                  )}
                  {installment.manual_status ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusBusyId === installment.id}
                      onClick={() => setManualStatus(installment, null)}
                    >
                      Clear
                    </Button>
                  ) : (
                    !settled && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={statusBusyId === installment.id}
                        onClick={() => setManualStatus(installment, "BOUNCED")}
                      >
                        Bounced
                      </Button>
                    )
                  )}
                </div>
              );
            },
          },
        ]
      : []),
  ];

  const paymentColumns: ColumnDef<LoanPayment>[] = [
    { key: "date", header: "Date", cell: (payment) => formatDate(payment.paid_on) },
    {
      key: "type",
      header: "Type",
      cell: (payment) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span>{getPaymentTypeLabel(payment.payment_type)}</span>
            {payment.is_reversal && <Badge variant="outline">Reversal</Badge>}
          </div>
          {payment.notes && (
            <span className="text-xs text-muted-foreground">{payment.notes}</span>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (payment) => (
        <span className="font-medium">
          <Money value={payment.amount} />
        </span>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      cell: (payment) => (
        <span className="text-muted-foreground">
          {payment.reference ?? payment.payment_method ?? "—"}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: "action",
            header: "",
            align: "right" as const,
            // A reversal can't itself be reversed, and neither can
            // something already undone.
            cell: (payment: LoanPayment) =>
              !payment.is_reversed && !payment.is_reversal ? (
                <div className={rowActionsClass}>
                  <Button size="sm" variant="outline" onClick={() => setReverseTarget(payment)}>
                    <UndoIcon size={14} style={{ marginRight: "0.35rem" }} />
                    Reverse
                  </Button>
                </div>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="container mx-auto animate-in space-y-6 fade-in duration-200">
      <PageHeader
        backHref="/admin/loans"
        backLabel="Back to loans"
        title={loan.lenders?.name ?? loan.loan_type}
        badge={
          <Badge variant={loan.status === "ACTIVE" ? "secondary" : "outline"}>
            {getLoanStatusLabel(loan.status)}
          </Badge>
        }
        description={[
          loan.loan_type,
          loan.entities ? `in the name of ${loan.entities.name}` : null,
          collateral,
          loan.loan_number ? `Loan No. ${loan.loan_number}` : null,
          loan.disbursed_amount != null && loan.disbursed_amount !== loan.principal_amount
            ? `Disbursed ${formatCurrency(loan.disbursed_amount)} of ${formatCurrency(loan.principal_amount)} principal`
            : null,
          loan.bank_accounts
            ? `Debits from ${formatBankAccountLabel(loan.bank_accounts, loan.bank_accounts.entities?.name)}${
                loan.mandate_type ? ` (${getMandateTypeLabel(loan.mandate_type)})` : ""
              }`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          canManage && loan.status === "ACTIVE" ? (
            <>
              <Button
                variant="outline"
                onClick={() => setPaymentModal({ type: "PREPAYMENT", installment: null })}
              >
                <HandCoinsIcon size={16} style={{ marginRight: "0.5rem" }} />
                Prepayment
              </Button>
              <Button
                variant="outline"
                onClick={() => setPaymentModal({ type: "CHARGE", installment: null })}
              >
                <ReceiptIcon size={16} style={{ marginRight: "0.5rem" }} />
                Charge
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setPaymentModal({ type: "FORECLOSURE", installment: null })
                }
              >
                Foreclose
              </Button>
            </>
          ) : undefined
        }
      />

      <div
        className={
          refreshing
            ? "grid grid-cols-1 gap-4 opacity-60 transition-opacity duration-200 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
            : "grid grid-cols-1 gap-4 transition-opacity duration-200 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
        }
      >
        {/* Outstanding is the one number this page exists to communicate —
            it gets a hero treatment with the progress bar folded directly
            in, instead of sitting in a same-size card as "EMI." */}
        <div className="flex flex-col justify-between gap-5 rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <HandCoinsIcon size={18} />
            </span>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Outstanding
            </span>
            {loan.outstanding_override != null && (
              <Badge variant="outline">Overridden</Badge>
            )}
          </div>

          <span className="text-4xl font-bold leading-tight tracking-tight tabular-nums text-foreground">
            <Money value={balance.outstanding} />
          </span>

          <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Principal</span>
              <span className="text-sm font-semibold text-foreground">
                <Money value={loan.principal_amount} />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Total Payable</span>
              <span className="text-sm font-semibold text-foreground">
                <Money value={balance.total_payable} />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Flat ROI</span>
              <span className="text-sm font-semibold text-foreground">
                {(() => {
                  const roi = flatRoiFromSchedule(
                    loan.principal_amount,
                    balance.total_payable,
                    loan.total_installments,
                  );
                  return roi != null ? `${roi.toFixed(2)}% p.a.` : "—";
                })()}
              </span>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {balance.installments_paid} of {loan.total_installments} installments paid
              </span>
              <span className="text-muted-foreground">
                {balance.next_due_date
                  ? `Next ${formatDate(balance.next_due_date)} (${relativeDueLabel(balance.next_due_date)})`
                  : "Nothing outstanding"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${progressPercent(balance.installments_paid, loan.total_installments)}%`,
                }}
              />
            </div>
            {loan.outstanding_override != null && (
              <p className="mt-3 text-xs text-muted-foreground">
                Overridden to match the lender&rsquo;s statement — the calculated
                figure from the schedule is{" "}
                <Money value={balance.total_payable - balance.total_paid} />.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <StatCard
            title="Total Paid"
            value={<Money value={balance.total_paid} />}
            icon={<CheckCircleIcon size={18} />}
            tone="positive"
          />
          <StatCard
            title="EMI"
            value={<Money value={loan.emi_amount} />}
            subtext={`Due day ${loan.emi_day_of_month} of each month`}
            icon={<ReceiptIcon size={18} />}
          />
          <StatCard
            title="Overdue"
            value={balance.overdue_count > 0 ? balance.overdue_count : "None"}
            subtext={
              balance.overdue_count > 0 ? <Money value={balance.overdue_amount} /> : undefined
            }
            icon={<AlertTriangleIcon size={18} />}
            tone={balance.overdue_count > 0 ? "critical" : "neutral"}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b border-border p-4 sm:p-6">
          <Tabs
            idPrefix="loan-detail"
            items={TABS}
            value={activeTab}
            onValueChange={setActiveTab}
          />
        </div>

        <div
          className="p-4 sm:p-6"
          role="tabpanel"
          id={`loan-detail-panel-${activeTab}`}
          aria-labelledby={`loan-detail-tab-${activeTab}`}
        >
          {error && (
            <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <BusyOverlay busy={refreshing}>
            {activeTab === "schedule" ? (
              <DataTable
                columns={scheduleColumns}
                data={installments}
                rowKey={(installment) => installment.id}
                showActions={false}
              />
            ) : (
              <DataTable
                columns={paymentColumns}
                data={payments}
                rowKey={(payment) => payment.id}
                showActions={false}
                emptyMessage="No payments recorded yet."
                rowClassName={(payment) =>
                  payment.is_reversed ? "text-muted-foreground line-through" : ""
                }
              />
            )}
          </BusyOverlay>
        </div>
      </div>

      {paymentModal && (
        <LoanPaymentModal
          isOpen
          loanId={loanId}
          paymentType={paymentModal.type}
          installment={paymentModal.installment}
          onClose={() => setPaymentModal(null)}
          onSuccess={() => void fetchLoan()}
        />
      )}

      <ConfirmModal
        isOpen={!!reverseTarget}
        onClose={() => {
          setReverseTarget(null);
          setReverseError(null);
        }}
        onConfirm={handleReverse}
        title="Reverse Payment"
        description={`This cancels ${formatCurrency(reverseTarget?.amount ?? 0)} recorded on ${formatDate(reverseTarget?.paid_on)}. Both the original and the reversal stay visible in the log.`}
        confirmText="Reverse"
        isLoading={reverseLoading}
        error={reverseError}
      />
    </div>
  );
}
