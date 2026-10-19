"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  HandCoinsIcon,
  SearchIcon,
  WalletIcon,
  XIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { addMonths } from "@/lib/dateOnly";
import { formatMonth } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import type { ColumnDef, RowAction } from "@/components/ui/dataTable";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatCard } from "@/components/ui/statCard";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { PageLoadingSkeleton } from "@/components/ui/pageLoadingSkeleton";
import { BusyOverlay } from "@/components/ui/busyOverlay";
import { formatMonthShort } from "@/components/attendancePage/attendancePage.utils";
import { SalaryMobileList, SalaryMobileSummary } from "./salaryMobileList";
import type { SalaryRow, SalarySheet } from "./salariesPage.types";

// Lazy-loaded: only needed once a driver is opened.
const SalaryDriverModal = dynamic(
  () => import("./salaryDriverModal").then((m) => m.SalaryDriverModal),
  { ssr: false },
);

// Lazy-loaded: only needed once an advance is being recorded.
const AddAdvanceModal = dynamic(
  () => import("./addAdvanceModal").then((m) => m.AddAdvanceModal),
  { ssr: false },
);

/**
 * The month's salary sheet: one line per driver, worked out by the server
 * from each driver's monthly salary, the attendance marks, and any advances
 * or deductions. Nothing on this page computes money — it shows the sheet and
 * reloads it after every change.
 */
export function SalariesPage() {
  const { loading: authLoading } = useAuth();
  const isMobile = useIsMobile();

  const [sheet, setSheet] = useState<SalarySheet | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [openDriverId, setOpenDriverId] = useState<number | null>(null);
  const [advanceDriver, setAdvanceDriver] = useState<SalaryRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Stepping months quickly overlaps requests; only the newest may land.
  const ticket = useRef(0);

  const fetchSheet = useCallback(async (month?: string) => {
    const mine = ++ticket.current;
    try {
      setFetching(true);
      setError(null);
      const res = await fetch(`/api/driver-salaries${month ? `?month=${month}` : ""}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load salaries");
      if (mine === ticket.current) setSheet(json.data as SalarySheet);
    } catch (err) {
      if (mine === ticket.current) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    } finally {
      if (mine === ticket.current) setFetching(false);
    }
  }, []);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!authLoading && !initialFetchDone.current) {
      initialFetchDone.current = true;
      void fetchSheet();
    }
  }, [authLoading, fetchSheet]);

  const query = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      (sheet?.drivers ?? []).filter(
        (row) =>
          !query ||
          row.name.toLowerCase().includes(query) ||
          (row.place ?? "").toLowerCase().includes(query),
      ),
    [sheet, query],
  );

  const exportSheet = async () => {
    if (!sheet) return;
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/driver-salaries/export?month=${sheet.month}`);
      if (!res.ok) throw new Error("Export failed");
      const url = window.URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `driver_salaries_${sheet.month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setExportError("Couldn't download the export. Try again.");
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || (fetching && !sheet)) return <PageLoadingSkeleton variant="admin" />;
  if (!sheet) {
    return (
      <ErrorState
        title="Couldn't load salaries"
        description={error ?? undefined}
        onRetry={() => fetchSheet()}
      />
    );
  }

  const currentMonth = sheet.today.slice(0, 7);
  const { totals } = sheet;

  const columns: ColumnDef<SalaryRow>[] = [
    {
      key: "driver",
      header: "Driver",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{row.name}</span>
          {(row.place || !row.is_active) && (
            <span className="text-xs text-muted-foreground">
              {[row.place, !row.is_active && "Inactive"].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      ),
    },
    {
      // Shared column for both pay types: a monthly figure for MONTHLY
      // drivers, a per-trip rate for PER_TRIP ones — the two never both
      // apply to the same driver, so one column reads cleanly either way.
      key: "monthly_salary",
      header: "Salary / Rate",
      align: "right",
      cell: (row) => {
        if (row.pay_type === "PER_TRIP") {
          return row.rate_per_trip == null ? (
            <span className="font-medium text-primary">Set rate</span>
          ) : (
            <span>
              <Money value={row.rate_per_trip} />
              <span className="text-muted-foreground">/trip</span>
            </span>
          );
        }
        return row.monthly_salary == null ? (
          // Reads as the thing to do next; the whole row opens the driver.
          <span className="font-medium text-primary">Set salary</span>
        ) : (
          <Money value={row.monthly_salary} />
        );
      },
    },
    {
      key: "unpaid_days",
      header: "Unpaid Days / Trips",
      cell: (row) => {
        if (row.pay_type === "PER_TRIP") {
          return row.trip_count == null ? (
            row.rate_per_trip == null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className="text-xs font-medium text-primary">Enter trips</span>
            )
          ) : (
            <span>{row.trip_count} trips</span>
          );
        }
        return (
          <div className="flex flex-col gap-0.5">
            <span>
              {row.unpaid_days}
              <span className="text-muted-foreground"> of {sheet.days_in_month}</span>
            </span>
            {row.unpaid_days > 0 && (
              <span className="text-xs text-muted-foreground">
                {row.absent_days} absent · {row.leave_days} leave
              </span>
            )}
            {row.unmarked_days > 0 && (
              <Badge variant="warning-subtle" className="self-start">
                {row.unmarked_days} not marked
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "attendance_cut",
      header: "Attendance Cut",
      align: "right",
      cell: (row) =>
        // No per-day cut applies to a PER_TRIP driver at all — the trip
        // count already reflects however much they drove.
        row.pay_type === "PER_TRIP" || row.monthly_salary == null || row.attendance_cut === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Money value={row.attendance_cut} />
        ),
    },
    {
      key: "advances",
      header: "Advances",
      align: "right",
      cell: (row) =>
        row.advances === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Money value={row.advances} />
        ),
    },
    {
      key: "deductions",
      header: "Deductions",
      align: "right",
      cell: (row) =>
        row.deductions === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Money value={row.deductions} />
        ),
    },
    {
      key: "net_pay",
      header: "Net Pay",
      align: "right",
      mobile: "trailing",
      cell: (row) =>
        row.net_pay == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <Money
              value={row.net_pay}
              tone={row.net_pay < 0 ? "negative" : "neutral"}
              className="font-semibold"
            />
            {row.is_settled && (
              <Badge variant="success-subtle" className="self-end">
                Paid
              </Badge>
            )}
          </div>
        ),
    },
  ];

  const rowActions: RowAction<SalaryRow>[] = [
    {
      key: "add-advance",
      label: "Add advance",
      icon: <HandCoinsIcon size={14} />,
      onClick: (row) => setAdvanceDriver(row),
      disabled: (row) => row.is_settled,
      disabledTooltip: "This month is settled — undo it first to add an advance",
    },
  ];

  const withoutSalary = totals.drivers_without_salary;
  const emptyState =
    sheet.drivers.length === 0 ? (
      <EmptyState
        title="No drivers yet"
        description="Add drivers on the Drivers page; they appear here once they exist."
        icon={HandCoinsIcon}
      />
    ) : rows.length === 0 ? (
      <EmptyState
        title="No drivers found"
        description="No driver matches this search."
        icon={SearchIcon}
      />
    ) : null;

  const driverModal = (
    <SalaryDriverModal
      driverId={openDriverId}
      month={sheet.month}
      onClose={() => setOpenDriverId(null)}
      onChanged={() => fetchSheet(sheet.month)}
    />
  );

  if (isMobile) {
    const iconButton =
      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-40";

    return (
      <div className="space-y-3 md:hidden">
        {/* One row: the month on the left, search and export as icons on the
            right. Search opens in place of the row, as on Attendance, so
            nothing below it jumps. */}
        {searchOpen ? (
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                data-testid="salaries-search-input"
                placeholder="Search driver or place..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="h-9 border-transparent bg-muted pl-9 pr-9 focus-visible:ring-1 focus-visible:ring-offset-0"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground"
                >
                  <XIcon size={16} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSearchOpen(false);
              }}
              className="h-9 shrink-0 px-1 text-sm font-medium text-primary"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => fetchSheet(addMonths(sheet.month, -1))}
                disabled={fetching}
                className={iconButton}
              >
                <ChevronLeftIcon size={18} />
              </button>
              {/* The label doubles as the month picker: a transparent native
                  input sits over it. */}
              <label className="relative min-w-[5.5rem] cursor-pointer text-center text-base font-semibold text-foreground">
                <span className="whitespace-nowrap">{formatMonthShort(sheet.month)}</span>
                <input
                  type="month"
                  data-testid="salaries-month-input"
                  aria-label="Choose month"
                  disabled={fetching}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
                  value={sheet.month}
                  max={currentMonth}
                  onChange={(e) => e.target.value && fetchSheet(e.target.value)}
                />
              </label>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => fetchSheet(addMonths(sheet.month, 1))}
                disabled={fetching || sheet.month >= currentMonth}
                className={iconButton}
              >
                <ChevronRightIcon size={18} />
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Search drivers"
                onClick={() => setSearchOpen(true)}
                disabled={fetching}
                className={iconButton}
              >
                <SearchIcon size={18} />
              </button>
              <button
                type="button"
                data-testid="salaries-export-btn"
                aria-label={exporting ? "Preparing export" : "Export this month"}
                disabled={fetching || exporting || sheet.drivers.length === 0}
                onClick={exportSheet}
                className={iconButton}
              >
                <DownloadIcon size={18} />
              </button>
            </div>
          </div>
        )}

        {exportError && <p className="text-sm text-destructive">{exportError}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <BusyOverlay busy={fetching}>
          {!query && <SalaryMobileSummary sheet={sheet} />}

          {!query && withoutSalary > 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              {withoutSalary} {withoutSalary === 1 ? "driver has" : "drivers have"} no salary set
              yet and {withoutSalary === 1 ? "is" : "are"} not in these totals.
            </p>
          )}

          {emptyState ?? (
            <SalaryMobileList rows={rows} onOpen={setOpenDriverId} onAddAdvance={setAdvanceDriver} />
          )}
        </BusyOverlay>

        {driverModal}
        {advanceDriver && (
          <AddAdvanceModal
            driverId={advanceDriver.driver_id}
            driverName={advanceDriver.name}
            month={sheet.month}
            onClose={() => setAdvanceDriver(null)}
            onSaved={() => fetchSheet(sheet.month)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 max-md:hidden md:space-y-8">
      <PageHeader
        title="Salaries"
        description="Each driver's monthly pay, worked out from attendance, advances and deductions."
      />

      <BusyOverlay busy={fetching}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            title="Monthly Salaries"
            value={<Money value={totals.monthly_salary} />}
            icon={<WalletIcon size={18} />}
          />
          <StatCard
            title="Attendance Cuts"
            value={<Money value={totals.attendance_cut} />}
            icon={<AlertTriangleIcon size={18} />}
          />
          <StatCard
            title="Advances & Deductions"
            value={<Money value={totals.advances + totals.deductions} />}
            subtext={
              <>
                <Money value={totals.advances} /> advances · <Money value={totals.deductions} /> other
              </>
            }
            icon={<HandCoinsIcon size={18} />}
          />
          <StatCard
            title="Net Payable"
            value={<Money value={totals.net_pay} />}
            subtext={sheet.is_provisional ? "So far this month" : undefined}
            icon={<WalletIcon size={18} />}
            tone="positive"
          />
        </div>
      </BusyOverlay>

      <div className="ss-panel overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:px-6">
          <div className="flex items-center gap-1 md:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSheet(addMonths(sheet.month, -1))}
              disabled={fetching}
              aria-label="Previous month"
            >
              <ChevronLeftIcon size={16} />
            </Button>
            <span className="min-w-[8.5rem] text-center font-semibold text-foreground">
              {formatMonth(sheet.month)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSheet(addMonths(sheet.month, 1))}
              disabled={fetching || sheet.month >= currentMonth}
              aria-label="Next month"
            >
              <ChevronRightIcon size={16} />
            </Button>
            <Input
              type="month"
              data-testid="salaries-month-input"
              aria-label="Choose month"
              disabled={fetching}
              className="ml-1 w-auto max-sm:hidden"
              value={sheet.month}
              max={currentMonth}
              onChange={(e) => e.target.value && fetchSheet(e.target.value)}
            />
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                data-testid="salaries-search-input"
                placeholder="Search driver or place..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={fetching}
                className="bg-background pl-9 pr-9"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <XIcon size={16} />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              data-testid="salaries-export-btn"
              disabled={fetching || exporting || sheet.drivers.length === 0}
              onClick={exportSheet}
            >
              <DownloadIcon size={16} className="mr-2" />
              {exporting ? "Preparing…" : "Export"}
            </Button>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-6">
          {exportError && <p className="text-sm text-destructive">{exportError}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {sheet.is_provisional && (
            <p className="rounded-xl border border-warning/40 bg-warning-subtle px-3 py-2 text-sm text-warning-subtle-foreground">
              {`${formatMonth(sheet.month)} isn't over yet. Absences and advances recorded later this month will change these figures.`}
            </p>
          )}
          {totals.drivers_without_salary > 0 && (
            <p className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {totals.drivers_without_salary}{" "}
              {totals.drivers_without_salary === 1 ? "driver has" : "drivers have"} no salary set and{" "}
              {totals.drivers_without_salary === 1 ? "is" : "are"} left out of the totals. Open a
              driver to set one.
            </p>
          )}

          {emptyState ?? (
            <>
              {/* Seven columns need more room than a tablet leaves beside the
                  sidebar, so below lg the sheet is the same slim list as on a
                  phone rather than a table that scrolls sideways. */}
              <div className="lg:hidden">
                <SalaryMobileList
                  rows={rows}
                  onOpen={setOpenDriverId}
                  onAddAdvance={setAdvanceDriver}
                />
              </div>
              <div className="max-lg:hidden">
                <DataTable
                  columns={columns}
                  data={rows}
                  rowKey={(row) => String(row.driver_id)}
                  loading={fetching}
                  rowClickable
                  onRowClick={(row) => setOpenDriverId(row.driver_id)}
                  rowActions={rowActions}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {driverModal}
      {advanceDriver && (
        <AddAdvanceModal
          driverId={advanceDriver.driver_id}
          driverName={advanceDriver.name}
          month={sheet.month}
          onClose={() => setAdvanceDriver(null)}
          onSaved={() => fetchSheet(sheet.month)}
        />
      )}
    </div>
  );
}
