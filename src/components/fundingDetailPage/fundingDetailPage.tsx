"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  UndoIcon,
  HandCoinsIcon,
  ReceiptIcon,
  PlusIcon,
  PencilIcon,
  CheckCircleIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { isAdmin as isAdminRole } from "@/lib/routePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/statCard";
import { PageHeader } from "@/components/ui/pageHeader";
import { Money } from "@/components/ui/money";
import { DataTable } from "@/components/ui/dataTable/dataTable";
import type { ColumnDef } from "@/components/ui/dataTable/dataTable.types";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { BusyOverlay } from "@/components/busyOverlay";
import { ErrorState } from "@/components/errorState";
import { FundingEntryModal } from "./fundingEntryModal";
import { RateChangeModal } from "./rateChangeModal";
import {
  getFundingEntryTypeLabel,
  getFundingTotalDueLabel,
  type Funding,
  type FundingComputation,
  type FundingEntry,
  type FundingEntryType,
  type FundingRate,
  type MonthlyBreakdownRow,
} from "@/components/loansPage/loansPage.types";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";

const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);

const TABS = [
  { key: "interest", label: "Interest" },
  { key: "entries", label: "Entries" },
  { key: "rates", label: "Rate History" },
];

export function FundingDetailPage({ fundingId }: { fundingId: number }) {
  const { userRole, loading: authLoading } = useAuth();
  const canManage = isAdminRole(userRole);

  const [funding, setFunding] = useState<Funding | null>(null);
  const [computed, setComputed] = useState<FundingComputation | null>(null);
  const [entries, setEntries] = useState<FundingEntry[]>([]);
  const [rates, setRates] = useState<FundingRate[]>([]);
  const [activeTab, setActiveTab] = useState("interest");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entryModal, setEntryModal] = useState<{
    type: FundingEntryType;
    suggested: number | null;
  } | null>(null);
  const [showRateModal, setShowRateModal] = useState(false);

  const [reverseTarget, setReverseTarget] = useState<FundingEntry | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);

  const fetchFunding = useCallback(async () => {
    try {
      setFetching(true);
      setError(null);

      const res = await fetch(`/api/fundings/${fundingId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load funding");

      setFunding(json.data.funding);
      setComputed(json.data.computed);
      setEntries(json.data.entries ?? []);
      setRates(json.data.rates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setFetching(false);
    }
  }, [fundingId]);

  useEffect(() => {
    if (!authLoading) void fetchFunding();
  }, [authLoading, fetchFunding]);

  const handleReverse = async () => {
    if (!reverseTarget) return;
    setReverseLoading(true);
    setReverseError(null);
    try {
      const res = await fetch(
        `/api/fundings/${fundingId}/entries/${reverseTarget.id}/reverse`,
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
      await fetchFunding();
    } catch {
      setReverseError("Network error");
    } finally {
      setReverseLoading(false);
    }
  };

  if (authLoading || (fetching && !funding)) {
    return <PageLoadingSkeleton variant="admin" />;
  }

  if (error && !funding) {
    return (
      <ErrorState title="Couldn't load funding" description={error} onRetry={fetchFunding} />
    );
  }

  if (!funding || !computed) return null;

  // Interest is recomputed server-side on every fetch, so a new entry changes
  // every number on this page — it says so while the refetch is in flight.
  const refreshing = fetching;
  const currentRate = rates.length > 0 ? rates[rates.length - 1] : null;
  const rateLabel = currentRate
    ? funding.interest_mode === "FIXED"
      ? `${formatCurrency(currentRate.fixed_interest_amount)} per month`
      : `${currentRate.roi}% ${currentRate.roi_basis === "ANNUAL" ? "per year" : "per month"}`
    : "—";

  const breakdownColumns: ColumnDef<MonthlyBreakdownRow>[] = [
    {
      key: "month",
      header: "Month",
      cell: (row) => <span className="font-medium">{formatMonth(row.month)}</span>,
    },
    {
      key: "days",
      header: "Days",
      align: "right",
      cell: (row) => <span className="text-muted-foreground">{row.days}</span>,
    },
    {
      key: "principal",
      header: "Principal",
      align: "right",
      cell: (row) => <Money value={row.average_principal} />,
    },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.monthly_rate != null ? `${row.monthly_rate}%` : "fixed"}
        </span>
      ),
    },
    {
      key: "interest",
      header: "Interest",
      align: "right",
      cell: (row) => <Money value={row.interest_accrued} precise />,
    },
    {
      key: "paid",
      header: "Paid",
      align: "right",
      cell: (row) =>
        row.interest_paid > 0 ? (
          <span className="text-muted-foreground">
            <Money value={row.interest_paid} precise />
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      cell: (row) => (
        <span className="font-semibold">
          <Money value={row.interest_balance} precise />
        </span>
      ),
    },
  ];

  const entryColumns: ColumnDef<FundingEntry>[] = [
    { key: "date", header: "Date", cell: (entry) => formatDate(entry.entry_date) },
    {
      key: "type",
      header: "Type",
      mobile: "subtitle",
      cell: (entry) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span>{getFundingEntryTypeLabel(entry.entry_type, funding.direction)}</span>
            {entry.is_reversal && <Badge variant="outline">Reversal</Badge>}
          </div>
          {entry.description && (
            <span className="text-xs text-muted-foreground">{entry.description}</span>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      mobile: "trailing",
      align: "right",
      cell: (entry) => (
        <span className="font-medium">
          <Money value={entry.amount} />
        </span>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      cell: (entry) => (
        <span className="text-muted-foreground">
          {entry.reference ?? entry.payment_method ?? "—"}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: "action",
            header: "Action",
            align: "right" as const,
            cell: (entry: FundingEntry) =>
              !entry.is_reversed && !entry.is_reversal ? (
                <div className="flex justify-end opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                  <Button size="sm" variant="outline" onClick={() => setReverseTarget(entry)}>
                    <UndoIcon size={14} style={{ marginRight: "0.35rem" }} />
                    Reverse
                  </Button>
                </div>
              ) : null,
          },
        ]
      : []),
  ];

  const rateColumns: ColumnDef<FundingRate>[] = [
    {
      key: "effective_from",
      header: "Effective From",
      cell: (rate, index) => (
        <div className="flex items-center gap-2">
          {formatDate(rate.effective_from)}
          {index === rates.length - 1 && <Badge variant="secondary">Current</Badge>}
        </div>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      mobile: "trailing",
      cell: (rate) =>
        funding.interest_mode === "FIXED"
          ? `${formatCurrency(rate.fixed_interest_amount)}/mo`
          : `${rate.roi}% ${rate.roi_basis === "ANNUAL" ? "p.a." : "p.m."}`,
    },
    {
      key: "note",
      header: "Note",
      cell: (rate) => <span className="text-muted-foreground">{rate.note ?? "—"}</span>,
    },
  ];

  return (
    <div className="container mx-auto animate-in space-y-6 fade-in duration-200">
      <PageHeader
        backHref="/admin/loans"
        backLabel="Back to loans"
        title={
          funding.direction === "LENT"
            ? (funding.counterparty?.name ?? "Money Lent")
            : (funding.lenders?.name ?? "Private Funding")
        }
        badge={
          <Badge variant={funding.status === "OPEN" ? "secondary" : "outline"}>
            {funding.status === "OPEN" ? "Open" : "Settled"}
          </Badge>
        }
        description={[
          rateLabel,
          `since ${formatDate(funding.start_date)}`,
          funding.borrower ? `in the name of ${funding.borrower.name}` : null,
          funding.interest_due_day
            ? `interest expected on the ${funding.interest_due_day}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          canManage && funding.status === "OPEN" ? (
            <>
              <Button
                onClick={() =>
                  setEntryModal({
                    type: "INTEREST_PAID",
                    suggested: computed.interest_due,
                  })
                }
              >
                <ReceiptIcon size={16} style={{ marginRight: "0.5rem" }} />
                {funding.direction === "LENT" ? "Receive Interest" : "Pay Interest"}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setEntryModal({
                    type: "PRINCIPAL_REPAID",
                    suggested: computed.principal_outstanding,
                  })
                }
              >
                <HandCoinsIcon size={16} style={{ marginRight: "0.5rem" }} />
                {funding.direction === "LENT" ? "Recover Principal" : "Repay Principal"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEntryModal({ type: "PRINCIPAL_TAKEN", suggested: null })}
              >
                <PlusIcon size={16} style={{ marginRight: "0.5rem" }} />
                {funding.direction === "LENT" ? "Lend More" : "Borrow More"}
              </Button>
              <Button variant="outline" onClick={() => setShowRateModal(true)}>
                <PencilIcon size={16} style={{ marginRight: "0.5rem" }} />
                Change Rate
              </Button>
            </>
          ) : undefined
        }
      />

      <div
        className={
          refreshing
            ? "grid grid-cols-2 gap-3 opacity-60 transition-opacity duration-200 sm:gap-4 xl:grid-cols-4"
            : "grid grid-cols-2 gap-3 transition-opacity duration-200 sm:gap-4 xl:grid-cols-4"
        }
      >
        <StatCard
          title="Principal Outstanding"
          value={<Money value={computed.principal_outstanding} />}
          icon={<HandCoinsIcon size={18} />}
        />
        <StatCard
          title="Interest Accrued"
          value={<Money value={computed.interest_accrued} precise />}
          icon={<ReceiptIcon size={18} />}
        />
        <StatCard
          title={funding.direction === "LENT" ? "Interest Receivable" : "Interest Due"}
          value={<Money value={computed.interest_due} precise />}
          icon={<ReceiptIcon size={18} />}
          tone={computed.interest_due > 0 ? "critical" : "neutral"}
        />
        <StatCard
          title={getFundingTotalDueLabel(funding.direction)}
          value={<Money value={computed.total_due} />}
          icon={<CheckCircleIcon size={18} />}
        />
      </div>

      <div className="ss-panel overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b border-border p-4 sm:p-6">
          <Tabs
            idPrefix="funding-detail"
            items={TABS}
            value={activeTab}
            onValueChange={setActiveTab}
          />
        </div>

        <div
          className="p-4 sm:p-6"
          role="tabpanel"
          id={`funding-detail-panel-${activeTab}`}
          aria-labelledby={`funding-detail-tab-${activeTab}`}
        >
          <BusyOverlay busy={refreshing}>
            {activeTab === "interest" ? (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  Interest is simple and never compounds — each month is charged on
                  the principal actually outstanding across its days, at whatever
                  rate was in force, pro-rated for part months.
                </p>
                <DataTable
                  columns={breakdownColumns}
                  data={computed.monthly_breakdown}
                  rowKey={(row) => row.month}
                  showActions={false}
                  emptyMessage="Nothing has accrued yet."
                />
              </>
            ) : activeTab === "entries" ? (
              <DataTable
                columns={entryColumns}
                data={entries}
                rowKey={(entry) => entry.id}
                showActions={false}
                emptyMessage="No entries yet."
                mobileLayout="timeline"
                rowClassName={(entry) => (entry.is_reversed ? "opacity-50 line-through" : "")}
              />
            ) : (
              <DataTable
                columns={rateColumns}
                data={rates}
                rowKey={(rate) => rate.id}
                showActions={false}
                emptyMessage="No rate history yet."
                mobileLayout="timeline"
              />
            )}
          </BusyOverlay>
        </div>
      </div>

      {entryModal && (
        <FundingEntryModal
          isOpen
          fundingId={fundingId}
          entryType={entryModal.type}
          direction={funding.direction}
          suggestedAmount={entryModal.suggested}
          onClose={() => setEntryModal(null)}
          onSuccess={() => void fetchFunding()}
        />
      )}

      <RateChangeModal
        isOpen={showRateModal}
        fundingId={fundingId}
        interestMode={funding.interest_mode}
        onClose={() => setShowRateModal(false)}
        onSuccess={() => void fetchFunding()}
      />

      <ConfirmModal
        isOpen={!!reverseTarget}
        onClose={() => {
          setReverseTarget(null);
          setReverseError(null);
        }}
        onConfirm={handleReverse}
        title="Reverse Entry"
        description={`This cancels ${formatCurrency(reverseTarget?.amount ?? 0)} recorded on ${formatDate(reverseTarget?.entry_date)}. Interest is recalculated as if it had never been entered.`}
        confirmText="Reverse"
        isLoading={reverseLoading}
        error={reverseError}
      />
    </div>
  );
}
