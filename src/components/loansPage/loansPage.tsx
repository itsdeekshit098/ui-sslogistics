"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  LandmarkIcon,
  AlertTriangleIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { isAdmin as isAdminRole } from "@/lib/routePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/statCard";
import { PageHeader } from "@/components/ui/pageHeader";
import { Money } from "@/components/ui/money";
import { SegmentedControl } from "@/components/ui/segmentedControl";
import { Pagination } from "@/components/pagination";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { BusyOverlay } from "@/components/busyOverlay";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { DataTable } from "@/components/ui/dataTable/dataTable";
import type { ColumnDef, RowAction } from "@/components/ui/dataTable/dataTable.types";
import {
  getLoanStatusLabel,
  type CalendarDay,
  type Funding,
  type FundingDirection,
  type Loan,
  type LoanSummary,
} from "./loansPage.types";
import {
  installmentStatusVariant,
  monthBounds,
  progressPercent,
  relativeDueLabel,
  shiftMonth,
} from "./loansPage.utils";
import { formatCurrency, formatDate, formatMonth, todayString } from "@/lib/format";

const LoanModal = dynamic(
  () => import("@/components/loanModal").then((m) => m.LoanModal),
  { ssr: false },
);
const FundingModal = dynamic(
  () => import("@/components/fundingModal").then((m) => m.FundingModal),
  { ssr: false },
);
const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);
const LoanAttachmentsModal = dynamic(
  () => import("@/components/loanAttachmentsModal").then((m) => m.LoanAttachmentsModal),
  { ssr: false },
);

type TabKey = "loans" | "fundings" | "lent" | "calendar";

const TABS = [
  { key: "loans", label: "Loans" },
  { key: "fundings", label: "Private Fundings" },
  { key: "lent", label: "Lent Out" },
  { key: "calendar", label: "EMI Calendar" },
];

export function LoansPage() {
  const router = useRouter();
  const { userRole, loading: authLoading } = useAuth();
  const canManage = isAdminRole(userRole);

  const [activeTab, setActiveTab] = useState<TabKey>("loans");

  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<LoanSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [fundings, setFundings] = useState<Funding[]>([]);
  const [fundingsLoaded, setFundingsLoaded] = useState(false);
  const [fundingsFetching, setFundingsFetching] = useState(false);

  // Money lent out is a separate list from money borrowed — the two must
  // never total together, so they get their own tab and their own state
  // rather than one list filtered client-side.
  const [lentFundings, setLentFundings] = useState<Funding[]>([]);
  const [lentLoaded, setLentLoaded] = useState(false);
  const [lentFetching, setLentFetching] = useState(false);
  const [fundingModalDirection, setFundingModalDirection] =
    useState<FundingDirection>("BORROWED");

  // Defaults to the current month, so the tab opens on something useful.
  const [calendarMonth, setCalendarMonth] = useState(() => monthBounds(new Date()).from);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [calendarTotal, setCalendarTotal] = useState(0);
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  const [calendarFetching, setCalendarFetching] = useState(false);

  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null);
  const [showFundingModal, setShowFundingModal] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Loan | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [attachmentsTarget, setAttachmentsTarget] = useState<Loan | null>(null);

  const fetchLoans = useCallback(async () => {
    try {
      setFetching(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        include_summary: "true",
      });
      if (statusFilter) params.set("status", statusFilter);
      if (overdueOnly) params.set("overdue_only", "true");

      const res = await fetch(`/api/loans?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load loans");

      setLoans(json.data.data ?? []);
      setTotal(json.data.total ?? 0);
      if (json.data.summary) setSummary(json.data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setFetching(false);
    }
  }, [page, pageSize, statusFilter, overdueOnly]);

  const fetchFundings = useCallback(async () => {
    try {
      setFundingsFetching(true);
      setError(null);
      const res = await fetch("/api/fundings?page_size=50&direction=BORROWED");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load fundings");
      setFundings(json.data.data ?? []);
      setFundingsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setFundingsFetching(false);
    }
  }, []);

  const fetchLentFundings = useCallback(async () => {
    try {
      setLentFetching(true);
      setError(null);
      const res = await fetch("/api/fundings?page_size=50&direction=LENT");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load lent fundings");
      setLentFundings(json.data.data ?? []);
      setLentLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLentFetching(false);
    }
  }, []);

  const fetchCalendar = useCallback(async (monthStart: string) => {
    try {
      setCalendarFetching(true);
      setError(null);
      const [year, month] = monthStart.slice(0, 7).split("-").map(Number);
      const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

      const res = await fetch(`/api/loans/calendar?from=${monthStart}&to=${to}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load calendar");

      setCalendarDays(json.data.days ?? []);
      setCalendarTotal(json.data.total_due ?? 0);
      setCalendarLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCalendarFetching(false);
    }
  }, []);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (authLoading) return;
    if (!initialFetchDone.current) initialFetchDone.current = true;
    void fetchLoans();
  }, [authLoading, fetchLoans]);

  // The other two tabs are fetched on first visit rather than up front — most
  // sessions only ever look at the loans list.
  const handleTabChange = (tab: string) => {
    const next = tab as TabKey;
    setActiveTab(next);
    if (next === "fundings" && !fundingsLoaded) void fetchFundings();
    if (next === "lent" && !lentLoaded) void fetchLentFundings();
    if (next === "calendar" && !calendarLoaded) void fetchCalendar(calendarMonth);
  };

  const changeMonth = (delta: number) => {
    const next = shiftMonth(calendarMonth, delta);
    setCalendarMonth(next);
    void fetchCalendar(next);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/loans?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        setDeleteError(json.error || "Failed to delete");
        return;
      }
      setDeleteTarget(null);
      void fetchLoans();
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const loanColumns: ColumnDef<Loan>[] = [
    {
      key: "loan_type",
      header: "Type",
      cell: (loan) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{loan.loan_type}</span>
          {loan.loan_number && (
            <span className="text-xs text-muted-foreground">{loan.loan_number}</span>
          )}
        </div>
      ),
    },
    {
      key: "borrower",
      header: "In Whose Name",
      cell: (loan) => (
        <div className="flex flex-col">
          <span>{loan.entities?.name ?? "—"}</span>
          {loan.entities && (
            <span className="text-xs text-muted-foreground">
              {loan.entities.entity_kind === "FIRM" ? "Firm" : "Person"}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "lender",
      header: "Lender / Collateral",
      cell: (loan) => (
        <div className="flex flex-col">
          <span>{loan.lenders?.name ?? "—"}</span>
          <span className="text-xs text-muted-foreground">
            {loan.vehicles?.vehicle_number ?? loan.collateral_description ?? ""}
          </span>
        </div>
      ),
    },
    {
      key: "emi_amount",
      header: "EMI",
      align: "right",
      cell: (loan) => <Money value={loan.emi_amount} />,
    },
    {
      key: "progress",
      header: "Paid",
      cell: (loan) => {
        const paid = loan.balance.installments_paid;
        const pct = progressPercent(paid, loan.total_installments);
        return (
          <div className="flex min-w-[7rem] flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {paid} / {loan.total_installments}
            </span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      cell: (loan) => (
        <span className="font-medium">
          <Money value={loan.balance.outstanding} />
        </span>
      ),
    },
    {
      key: "next_due",
      header: "Next EMI",
      cell: (loan) => {
        if (!loan.balance.next_due_date) {
          return <span className="text-muted-foreground">—</span>;
        }
        const isOverdue = loan.balance.overdue_count > 0;
        return (
          <div className="flex flex-col">
            <span className={isOverdue ? "font-medium text-destructive" : ""}>
              {formatDate(loan.balance.next_due_date)}
            </span>
            <span
              className={
                isOverdue ? "text-xs text-destructive" : "text-xs text-muted-foreground"
              }
            >
              {isOverdue
                ? `${loan.balance.overdue_count} overdue`
                : relativeDueLabel(loan.balance.next_due_date)}
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (loan) => (
        <Badge variant={loan.status === "ACTIVE" ? "secondary" : "outline"}>
          {getLoanStatusLabel(loan.status)}
        </Badge>
      ),
    },
  ];

  const loanActions: RowAction<Loan>[] = [
    {
      key: "attachments",
      label: "Documents",
      icon: <FileTextIcon size={14} />,
      onClick: (loan) => setAttachmentsTarget(loan),
    },
    {
      key: "edit",
      label: "Edit",
      icon: <PencilIcon size={14} />,
      hidden: () => !canManage,
      onClick: (loan) => {
        setLoanToEdit(loan);
        setShowLoanModal(true);
      },
    },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2Icon size={14} />,
      variant: "danger",
      hidden: () => !canManage,
      onClick: (loan) => setDeleteTarget(loan),
    },
  ];

  const buildFundingColumns = (direction: FundingDirection): ColumnDef<Funding>[] => [
    {
      key: "counterparty",
      header: direction === "LENT" ? "Borrower" : "Funder",
      cell: (funding) =>
        direction === "LENT" ? (
          <span className="font-medium text-foreground">
            {funding.counterparty?.name ?? "—"}
          </span>
        ) : (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
              {funding.lenders?.name ?? "—"}
            </span>
            {funding.borrower && (
              <span className="text-xs text-muted-foreground">
                for {funding.borrower.name}
              </span>
            )}
          </div>
        ),
    },
    {
      key: "principal",
      header: "Principal Outstanding",
      align: "right",
      cell: (funding) => <Money value={funding.computed?.principal_outstanding} />,
    },
    {
      key: "rate",
      header: "Rate",
      cell: (funding) => {
        const rate = funding.current_rate;
        if (!rate) return <span className="text-muted-foreground">—</span>;
        if (funding.interest_mode === "FIXED") {
          return `${formatCurrency(rate.fixed_interest_amount)}/mo`;
        }
        return `${rate.roi}% ${rate.roi_basis === "ANNUAL" ? "p.a." : "p.m."}`;
      },
    },
    {
      key: "accrued",
      header: "Interest Accrued",
      align: "right",
      cell: (funding) => <Money value={funding.computed?.interest_accrued} precise />,
    },
    {
      key: "due",
      header: "Interest Due",
      align: "right",
      cell: (funding) => {
        const due = funding.computed?.interest_due ?? 0;
        return (
          <span className="font-medium">
            <Money value={due} precise tone={due > 0 ? "negative" : "neutral"} />
          </span>
        );
      },
    },
    {
      key: "since",
      header: "Since",
      cell: (funding) => formatDate(funding.start_date),
    },
    {
      key: "status",
      header: "Status",
      cell: (funding) => (
        <Badge variant={funding.status === "OPEN" ? "secondary" : "outline"}>
          {funding.status === "OPEN" ? "Open" : "Settled"}
        </Badge>
      ),
    },
  ];

  if (authLoading) return <PageLoadingSkeleton variant="admin" />;

  return (
    <div className="container mx-auto animate-in space-y-6 fade-in duration-200 md:space-y-8">
      <PageHeader
        title="Loans"
        description="Bank and finance-company loans, private borrowings, and what falls due when."
        actions={
          canManage ? (
            <Button
              data-testid="loans-primary-action-btn"
              className="w-full sm:w-auto"
              onClick={() => {
                if (activeTab === "fundings" || activeTab === "lent") {
                  setFundingModalDirection(activeTab === "lent" ? "LENT" : "BORROWED");
                  setShowFundingModal(true);
                } else {
                  setLoanToEdit(null);
                  setShowLoanModal(true);
                }
              }}
            >
              <PlusIcon size={16} style={{ marginRight: "0.5rem" }} />
              {activeTab === "lent"
                ? "Lend Money"
                : activeTab === "fundings"
                  ? "Add Funding"
                  : "New Loan"}
            </Button>
          ) : undefined
        }
      />

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Total Outstanding"
            value={<Money value={summary.totalOutstanding} />}
            icon={<LandmarkIcon size={18} />}
          />
          <StatCard
            title="Monthly EMI Outgo"
            value={<Money value={summary.totalMonthlyEmi} />}
            icon={<CalendarIcon size={18} />}
          />
          <StatCard
            title="Due This Month"
            value={summary.dueThisMonth}
            icon={<CalendarIcon size={18} />}
          />
          <StatCard
            title="Overdue"
            value={summary.overdueCount > 0 ? summary.overdueCount : "None"}
            subtext={
              summary.overdueCount > 0 ? <Money value={summary.overdueAmount} /> : undefined
            }
            icon={<AlertTriangleIcon size={18} />}
            tone={summary.overdueCount > 0 ? "critical" : "neutral"}
            onClick={
              summary.overdueCount > 0
                ? () => {
                    setActiveTab("loans");
                    setOverdueOnly(true);
                    setPage(1);
                  }
                : undefined
            }
          />
          <StatCard
            title="Active Loans"
            value={summary.activeLoans}
            icon={<LandmarkIcon size={18} />}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b border-border p-4 sm:p-6">
          <Tabs
            idPrefix="loans"
            items={TABS}
            value={activeTab}
            onValueChange={handleTabChange}
          />
        </div>

        <div
          className="p-4 sm:p-6"
          role="tabpanel"
          id={`loans-panel-${activeTab}`}
          aria-labelledby={`loans-tab-${activeTab}`}
        >
          {error ? (
            <ErrorState
              title="Couldn't load"
              description={error}
              onRetry={() => {
                if (activeTab === "loans") void fetchLoans();
                else if (activeTab === "fundings") void fetchFundings();
                else if (activeTab === "lent") void fetchLentFundings();
                else void fetchCalendar(calendarMonth);
              }}
            />
          ) : activeTab === "loans" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl
                  idPrefix="loan-status"
                  items={[
                    { key: "", label: "All" },
                    { key: "ACTIVE", label: "Active" },
                    { key: "CLOSED", label: "Closed" },
                  ]}
                  value={statusFilter}
                  onValueChange={(key) => {
                    setStatusFilter(key);
                    setPage(1);
                  }}
                />
                {/* A filter chip, not a primary action — kept off the
                    solid-fill button style so it doesn't compete with
                    "New Loan" for attention. */}
                <Button
                  data-testid="loans-overdue-toggle"
                  variant="outline"
                  size="sm"
                  aria-pressed={overdueOnly}
                  className={
                    overdueOnly
                      ? "border-destructive/40 bg-destructive-subtle text-destructive hover:bg-destructive-subtle"
                      : "text-destructive"
                  }
                  onClick={() => {
                    setOverdueOnly((prev) => !prev);
                    setPage(1);
                  }}
                >
                  Overdue only
                </Button>
              </div>

              {!fetching && loans.length === 0 ? (
                <EmptyState
                  title="No loans yet"
                  description="Record your first loan to start tracking EMIs and outstanding balances."
                  actionLabel={canManage ? "New Loan" : undefined}
                  onAction={
                    canManage
                      ? () => {
                          setLoanToEdit(null);
                          setShowLoanModal(true);
                        }
                      : undefined
                  }
                  icon={LandmarkIcon}
                />
              ) : (
                <>
                  <DataTable
                    columns={loanColumns}
                    data={loans}
                    rowKey={(loan) => String(loan.id)}
                    loading={fetching}
                    rowClickable
                    onRowClick={(loan) => router.push(`/admin/loans/${loan.id}`)}
                    showActions={canManage}
                    rowActions={loanActions}
                  />
                  <Pagination
                    page={page}
                    totalCount={total}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                  />
                </>
              )}
            </div>
          ) : activeTab === "fundings" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Money borrowed from private funders. Interest is simple and never
                compounds — it accrues day by day on whatever principal is still
                outstanding.
              </p>

              {fundingsLoaded && !fundingsFetching && fundings.length === 0 ? (
                <EmptyState
                  title="No private fundings"
                  description="Nothing borrowed from private funders yet."
                  actionLabel={canManage ? "Add Funding" : undefined}
                  onAction={
                    canManage
                      ? () => {
                          setFundingModalDirection("BORROWED");
                          setShowFundingModal(true);
                        }
                      : undefined
                  }
                  icon={LandmarkIcon}
                />
              ) : (
                <DataTable
                  columns={buildFundingColumns("BORROWED")}
                  data={fundings}
                  rowKey={(funding) => String(funding.id)}
                  loading={!fundingsLoaded || fundingsFetching}
                  rowClickable
                  onRowClick={(funding) => router.push(`/admin/fundings/${funding.id}`)}
                />
              )}
            </div>
          ) : activeTab === "lent" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Money lent to individuals at an agreed rate. Interest is simple and
                never compounds — it accrues day by day on whatever principal is
                still out.
              </p>

              {lentLoaded && !lentFetching && lentFundings.length === 0 ? (
                <EmptyState
                  title="Nothing lent out"
                  description="Nothing lent to individuals yet."
                  actionLabel={canManage ? "Lend Money" : undefined}
                  onAction={
                    canManage
                      ? () => {
                          setFundingModalDirection("LENT");
                          setShowFundingModal(true);
                        }
                      : undefined
                  }
                  icon={LandmarkIcon}
                />
              ) : (
                <DataTable
                  columns={buildFundingColumns("LENT")}
                  data={lentFundings}
                  rowKey={(funding) => String(funding.id)}
                  loading={!lentLoaded || lentFetching}
                  rowClickable
                  onRowClick={(funding) => router.push(`/admin/fundings/${funding.id}`)}
                />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changeMonth(-1)}
                    aria-label="Previous month"
                  >
                    <ChevronLeftIcon size={16} />
                  </Button>
                  <span className="min-w-[9rem] text-center font-medium text-foreground">
                    {formatMonth(calendarMonth)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changeMonth(1)}
                    aria-label="Next month"
                  >
                    <ChevronRightIcon size={16} />
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <Input
                    data-testid="loans-calendar-month-input"
                    type="month"
                    className="w-auto"
                    value={calendarMonth.slice(0, 7)}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const next = `${e.target.value}-01`;
                      setCalendarMonth(next);
                      void fetchCalendar(next);
                    }}
                  />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Due: </span>
                    <span className="font-semibold text-foreground">
                      <Money value={calendarTotal} />
                    </span>
                  </div>
                </div>
              </div>

              <BusyOverlay busy={calendarFetching}>
                {calendarLoaded && !calendarFetching && calendarDays.length === 0 ? (
                <EmptyState
                  title="Nothing due"
                  description="No EMIs fall in this month, and nothing is overdue."
                  icon={CalendarIcon}
                />
              ) : (
                <div className="space-y-3">
                  {/* Overdue days surface first regardless of date, so what
                      needs attention isn't buried mid-scroll in a long month. */}
                  {[...calendarDays]
                    .sort((a, b) => {
                      if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
                      return a.date.localeCompare(b.date);
                    })
                    .map((day) => {
                      const isToday = day.date.slice(0, 10) === todayString();
                      return (
                    <div
                      key={day.date}
                      className={
                        day.is_overdue
                          ? "rounded-lg border border-destructive/30 bg-destructive-subtle p-4"
                          : isToday
                            ? "rounded-lg border border-primary/40 bg-card p-4 ring-1 ring-primary/20"
                            : "rounded-lg border border-border bg-card p-4"
                      }
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {formatDate(day.date)}
                          </span>
                          {day.is_overdue && <Badge variant="destructive-subtle">Overdue</Badge>}
                          {isToday && <Badge variant="info-subtle">Today</Badge>}
                          <span className="text-xs text-muted-foreground">
                            {relativeDueLabel(day.date)}
                          </span>
                        </div>
                        <span className="font-semibold text-foreground">
                          <Money value={day.total} />
                        </span>
                      </div>

                      <ul className="divide-y divide-border">
                        {day.installments.map((installment) => (
                          <li
                            key={installment.id}
                            className="flex cursor-pointer items-center justify-between gap-3 py-2 hover:bg-accent/40"
                            onClick={() =>
                              installment.loan &&
                              router.push(`/admin/loans/${installment.loan.id}`)
                            }
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">
                                {installment.loan?.lenders?.name ??
                                  installment.loan?.loan_type ??
                                  "Loan"}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {installment.loan?.entities?.name}
                                {installment.loan?.vehicles?.vehicle_number
                                  ? ` · ${installment.loan.vehicles.vehicle_number}`
                                  : ""}
                                {` · EMI ${installment.installment_no}`}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <Badge variant={installmentStatusVariant(installment.status)} dot>
                                {installment.status}
                              </Badge>
                              <span className="text-sm font-medium">
                                <Money value={installment.amount_remaining} />
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                      );
                    })}
                </div>
              )}
              </BusyOverlay>
            </div>
          )}
        </div>
      </div>

      <LoanModal
        isOpen={showLoanModal}
        loanToEdit={loanToEdit}
        onClose={() => setShowLoanModal(false)}
        onSuccess={() => void fetchLoans()}
      />

      <FundingModal
        isOpen={showFundingModal}
        direction={fundingModalDirection}
        onClose={() => setShowFundingModal(false)}
        onSuccess={() =>
          void (fundingModalDirection === "LENT" ? fetchLentFundings() : fetchFundings())
        }
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Delete Loan"
        description="This removes the loan along with its entire schedule and payment history. This cannot be undone."
        confirmText="Delete"
        isLoading={deleteLoading}
        error={deleteError}
      />

      {attachmentsTarget && (
        <LoanAttachmentsModal
          isOpen={!!attachmentsTarget}
          onClose={() => setAttachmentsTarget(null)}
          loanId={attachmentsTarget.id}
          loanLabel={
            attachmentsTarget.loan_number
              ? `${attachmentsTarget.loan_type} · ${attachmentsTarget.loan_number}`
              : attachmentsTarget.loan_type
          }
          canManage={canManage}
        />
      )}
    </div>
  );
}
