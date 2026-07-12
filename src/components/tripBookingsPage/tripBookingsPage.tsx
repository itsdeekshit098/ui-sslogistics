"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  PlusIcon,
  PencilIcon,
  XIcon,
  CheckCircleIcon,
  ClockIcon,
  SlidersHorizontalIcon,
  SearchIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { canEdit as canEditRole, isAdmin as isAdminRole } from "@/lib/routePermissions";
import {
  TRIP_BOOKING_STATUS_LABELS,
  getDefaultTripBookingFilters,
} from "./tripBookingsPage.types";
import type {
  TripBookingStatus,
  TripBookingWithDetails,
  TripBookingFilters,
  TripBookingSummary,
} from "./tripBookingsPage.types";
import type { Vehicle } from "@/app/admin/vehicles/vehicles.types";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterDrawer, fieldGroup as filterFieldGroup, fieldLabel as filterFieldLabel } from "@/components/ui/filterDrawer";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { Pagination } from "@/components/pagination";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { DataTable } from "@/components/ui/dataTable/dataTable";
import type { ColumnDef, RowAction } from "@/components/ui/dataTable/dataTable.types";
import * as styles from "./tripBookingsPage.style";

// Lazy-loaded: only needed once a user opens one of these modals, so they
// shouldn't bloat the initial page chunk that has to load before anything
// (including the skeleton) can paint.
const TripBookingsModal = dynamic(
  () => import("../tripBookingsModal").then((m) => m.TripBookingsModal),
  { ssr: false },
);
const ExternalTripsModal = dynamic(
  () => import("../externalTripsModal").then((m) => m.ExternalTripsModal),
  { ssr: false },
);
const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(booking: TripBookingWithDetails): boolean {
  return booking.status === "confirmed" && booking.start_date < todayStr();
}

function isToday(booking: TripBookingWithDetails): boolean {
  return booking.status === "confirmed" && booking.start_date === todayStr();
}

function statusBadgeStyle(status: TripBookingStatus): React.CSSProperties {
  switch (status) {
    case "confirmed":
      return { ...styles.statusBadgeBase, ...styles.statusConfirmed };
    case "completed":
      return { ...styles.statusBadgeBase, ...styles.statusCompleted };
    case "cancelled":
      return { ...styles.statusBadgeBase, ...styles.statusCancelled };
  }
}

export function TripBookingsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const canEdit = canEditRole(userRole);
  const canManage = isAdminRole(userRole);
  const searchParams = useSearchParams();

  const [bookings, setBookings] = useState<TripBookingWithDetails[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<TripBookingFilters>(getDefaultTripBookingFilters);
  const [summary, setSummary] = useState<TripBookingSummary>({
    upcomingCount: 0,
    overdueCount: 0,
    completedCount: 0,
    cancelledCount: 0,
  });
  const [totalRecords, setTotalRecords] = useState(0);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFilters, setDrawerFilters] = useState<TripBookingFilters>(
    getDefaultTripBookingFilters,
  );

  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState<TripBookingWithDetails | null>(null);
  const [completeTarget, setCompleteTarget] = useState<TripBookingWithDetails | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TripBookingWithDetails | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const buildApiUrl = useCallback(
    (f: TripBookingFilters, includeSummary = true) => {
      const p = new URLSearchParams();
      if (f.status !== "all") p.set("status", f.status);
      if (f.onDate) {
        p.set("on_date", f.onDate);
      } else {
        if (f.fromDate) p.set("from_date", f.fromDate);
        if (f.toDate) p.set("to_date", f.toDate);
      }
      if (f.search.trim()) p.set("search", f.search.trim());
      p.set("page", String(f.page));
      p.set("page_size", String(f.pageSize));
      if (includeSummary) p.set("include_summary", "true");
      return `/api/trip-bookings?${p.toString()}`;
    },
    [],
  );

  const fetchBookings = useCallback(
    async (
      f: TripBookingFilters,
      opts: { includeSummary?: boolean } = {},
    ) => {
      const { includeSummary = true } = opts;
      try {
        setFetching(true);
        setError(null);
        const res = await fetch(buildApiUrl(f, includeSummary));
        if (!res.ok) throw new Error("Failed to fetch trip bookings");
        const json = await res.json();
        const result = json.data ?? {};
        setBookings(result.data || []);
        setTotalRecords(result.total ?? 0);
        if (result.summary) {
          setSummary(result.summary);
        }
        setFilters(f);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        setBookings([]);
        setTotalRecords(0);
      } finally {
        setFetching(false);
      }
    },
    [buildApiUrl],
  );

  const fetchVehicles = useCallback(async () => {
    try {
      // The Assigned Vehicle typeahead in tripBookingsModal filters this list
      // client-side, so it needs the whole fleet, not just page 1 — /api/vehicles
      // caps pageSize at 100, so page through it until every vehicle is loaded.
      const pageSize = 100;
      let page = 1;
      let all: Vehicle[] = [];
      while (true) {
        const res = await fetch(`/api/vehicles?page=${page}&pageSize=${pageSize}`);
        if (!res.ok) break;
        const json = await res.json();
        const pageData: Vehicle[] = json.data?.data ?? [];
        all = all.concat(pageData);
        const total = json.data?.total ?? all.length;
        if (pageData.length === 0 || all.length >= total) break;
        page += 1;
      }
      setVehicles(all);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      const bookingIdParam = searchParams.get("booking_id");
      const initial = bookingIdParam
        ? { ...getDefaultTripBookingFilters(), status: "all" as const }
        : getDefaultTripBookingFilters();
      fetchBookings(initial);
      fetchVehicles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const openDrawer = () => {
    setDrawerFilters({ ...filters });
    setDrawerOpen(true);
  };

  const applyDrawerFilters = () => {
    const next: TripBookingFilters = { ...drawerFilters, page: 1 };
    fetchBookings(next);
    setDrawerOpen(false);
  };

  const clearAllFilters = () => {
    const defaults = getDefaultTripBookingFilters();
    setDrawerFilters(defaults);
    fetchBookings(defaults);
    setDrawerOpen(false);
  };

  const handlePageChange = (page: number) => {
    fetchBookings({ ...filters, page }, { includeSummary: false });
  };

  const handlePageSizeChange = (size: number) => {
    fetchBookings({ ...filters, pageSize: size, page: 1 });
  };

  const runSearch = (search: string) => {
    fetchBookings({ ...filters, search, page: 1 });
  };

  const handleSuccess = async () => {
    await fetchBookings(filters);
  };

  const handleEdit = (b: TripBookingWithDetails) => {
    setEditRecord(b);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditRecord(null);
    setShowModal(true);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/trip-bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cancelTarget.id, status: "cancelled" }),
      });
      if (!res.ok) {
        const d = await res.json();
        setCancelError(d.error || "Failed to cancel booking");
      } else {
        await fetchBookings(filters);
        setCancelTarget(null);
      }
    } catch {
      setCancelError("Network error");
    } finally {
      setCancelLoading(false);
    }
  };

  const displayData = bookings;

  const activeFilterCount = [
    filters.status !== "confirmed" ? filters.status : "",
    filters.onDate,
    filters.onDate ? "" : filters.fromDate,
    filters.onDate ? "" : filters.toDate,
    filters.search,
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const fmtCurrency = (v: number) => `₹${Number(v).toLocaleString("en-IN")}`;

  const columns: ColumnDef<TripBookingWithDetails>[] = [
    {
      key: "customer",
      header: "Customer",
      cell: (b) => (
        <div>
          <div className="font-medium text-foreground whitespace-nowrap">{b.customer_name}</div>
          {b.customer_phone && (
            <div className="text-xs text-muted-foreground">{b.customer_phone}</div>
          )}
        </div>
      ),
    },
    {
      key: "route",
      header: "Route",
      cell: (b) => {
        const route = [b.from_location, b.to_location].filter(Boolean).join(" → ");
        return (
          <span className="text-muted-foreground max-w-[180px] truncate block" title={route}>
            {route || "—"}
          </span>
        );
      },
    },
    {
      key: "start_date",
      header: "Start Date",
      cell: (b) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-muted-foreground">{b.start_date}</span>
          {isOverdue(b) && <span style={styles.overdueBadge}>Overdue</span>}
          {isToday(b) && <span style={styles.todayBadge}>Today</span>}
        </div>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (b) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {b.vehicles?.vehicle_number ||
            `${b.vehicle_type}${b.seating_capacity ? ` · ${b.seating_capacity} seats` : ""} — not assigned yet`}
        </span>
      ),
    },
    {
      key: "driver",
      header: "Driver",
      cell: (b) => (
        <span className="text-muted-foreground whitespace-nowrap">{b.drivers?.name || "—"}</span>
      ),
    },
    {
      key: "amounts",
      header: "Quoted / Advance",
      align: "right",
      cell: (b) => (
        <span className="text-foreground whitespace-nowrap">
          {b.quoted_amount != null ? fmtCurrency(b.quoted_amount) : "—"} /{" "}
          {fmtCurrency(b.advance_amount || 0)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (b) => (
        <span style={statusBadgeStyle(b.status)}>{TRIP_BOOKING_STATUS_LABELS[b.status]}</span>
      ),
    },
  ];

  const rowActions: RowAction<TripBookingWithDetails>[] = [
    {
      key: "complete",
      label: "Complete",
      icon: <CheckCircleIcon size={14} />,
      hidden: (b) => !canEdit || b.status !== "confirmed",
      onClick: (b) => setCompleteTarget(b),
    },
    {
      key: "edit",
      label: "Edit",
      icon: <PencilIcon size={14} />,
      hidden: (b) => !canManage || b.status !== "confirmed",
      onClick: handleEdit,
    },
    {
      key: "cancel",
      label: "Cancel",
      icon: <XIcon size={14} />,
      variant: "danger",
      hidden: (b) => !canManage || b.status !== "confirmed",
      onClick: (b) => setCancelTarget(b),
    },
  ];

  if (authLoading) return <PageLoadingSkeleton variant="admin" />;
  if (error && bookings.length === 0)
    return (
      <ErrorState
        title="Error"
        description={error}
        onRetry={() => fetchBookings(filters)}
      />
    );

  return (
    <div className="container mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Trip Bookings</h1>
          <p className="text-muted-foreground mt-1">
            Advance bookings taken over the phone — confirmed, upcoming, and completed.
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleAddNew} className="w-full sm:w-auto">
            <PlusIcon size={16} style={{ marginRight: "0.5rem" }} /> New Booking
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        {/* ── Summary Strip ── */}
        <div className="px-4 sm:px-6 pt-4">
          <div
            style={{
              ...styles.summaryStrip,
              opacity: fetching ? 0.5 : 1,
              transition: "opacity 0.2s ease",
            }}
          >
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Upcoming</span>
              <span style={styles.summaryValue}>{summary.upcomingCount}</span>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Overdue</span>
              <span style={{ ...styles.summaryValue, ...styles.overdueValue }}>
                {summary.overdueCount}
              </span>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Completed</span>
              <span style={styles.summaryValue}>{summary.completedCount}</span>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Cancelled</span>
              <span style={styles.summaryValue}>{summary.cancelledCount}</span>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-4">
            <div className="relative w-full sm:w-72">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search customer name or phone..."
                defaultValue={filters.search}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch((e.target as HTMLInputElement).value);
                }}
                onBlur={(e) => runSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-primary">
                  Clear all
                </Button>
              )}
              <Button variant="outline" onClick={openDrawer} className="gap-2">
                <SlidersHorizontalIcon size={16} />
                Filters
                {activeFilterCount > 0 && (
                  <span style={styles.activeFilterBadge}>{activeFilterCount}</span>
                )}
              </Button>
            </div>
          </div>

          {error ? (
            <ErrorState
              title="Couldn't load trip bookings"
              description={error}
              onRetry={() => fetchBookings(filters)}
            />
          ) : !fetching && displayData.length === 0 ? (
            <EmptyState
              title="No trip bookings found"
              description={
                hasActiveFilters
                  ? "Try adjusting your filters."
                  : "Record a customer's advance booking so it's not forgotten."
              }
              actionLabel={hasActiveFilters ? "Clear Filters" : "New Booking"}
              onAction={hasActiveFilters ? clearAllFilters : handleAddNew}
              icon={ClockIcon}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <DataTable
                  columns={columns}
                  data={displayData}
                  rowKey={(b) => String(b.id)}
                  loading={fetching}
                  showActions={canEdit}
                  rowActions={rowActions}
                  rowStyle={(b) =>
                    isOverdue(b)
                      ? styles.rowHighlightOverdue
                      : isToday(b)
                        ? styles.rowHighlightToday
                        : {}
                  }
                />
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {fetching ? (
                  <LoadingSpinner size="md" centered label="Loading bookings..." />
                ) : (
                  displayData.map((b) => {
                    const route = [b.from_location, b.to_location].filter(Boolean).join(" → ");
                    return (
                      <div
                        key={b.id}
                        className="rounded-lg border bg-card p-4 shadow-sm"
                        style={
                          isOverdue(b)
                            ? styles.rowHighlightOverdue
                            : isToday(b)
                              ? styles.rowHighlightToday
                              : undefined
                        }
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-foreground text-lg">
                              {b.customer_name}
                            </div>
                            {b.customer_phone && (
                              <div className="text-sm text-muted-foreground">
                                {b.customer_phone}
                              </div>
                            )}
                          </div>
                          <span style={statusBadgeStyle(b.status)}>
                            {TRIP_BOOKING_STATUS_LABELS[b.status]}
                          </span>
                        </div>
                        {route && (
                          <div className="text-sm text-muted-foreground mb-1">📍 {route}</div>
                        )}
                        <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                          📅 {b.start_date}
                          {isOverdue(b) && <span style={styles.overdueBadge}>Overdue</span>}
                          {isToday(b) && <span style={styles.todayBadge}>Today</span>}
                        </div>
                        <div className="text-sm text-muted-foreground mb-1">
                          🚌{" "}
                          {b.vehicles?.vehicle_number ||
                            `${b.vehicle_type}${b.seating_capacity ? ` · ${b.seating_capacity} seats` : ""} — not assigned yet`}
                        </div>
                        {b.drivers?.name && (
                          <div className="text-sm text-muted-foreground mb-1">
                            🧑‍✈️ {b.drivers.name}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground mb-3">
                          Quoted {b.quoted_amount != null ? fmtCurrency(b.quoted_amount) : "—"} ·
                          Advance {fmtCurrency(b.advance_amount || 0)}
                        </div>
                        {canEdit && b.status === "confirmed" && (
                          <div className="flex items-center justify-end gap-2 border-t pt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCompleteTarget(b)}
                            >
                              Complete
                            </Button>
                            {canManage && (
                              <>
                                <Button variant="outline" size="sm" onClick={() => handleEdit(b)}>
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => setCancelTarget(b)}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {totalRecords > 0 && (
            <div className="mt-4">
              <Pagination
                page={filters.page}
                totalCount={totalRecords}
                pageSize={filters.pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Filter Drawer ── */}
      <FilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onApply={applyDrawerFilters}>
        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>Status</Label>
          <Select
            value={drawerFilters.status}
            onValueChange={(v) =>
              setDrawerFilters((p) => ({ ...p, status: v as TripBookingStatus | "all" }))
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {(Object.entries(TRIP_BOOKING_STATUS_LABELS) as [TripBookingStatus, string][]).map(
                ([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>On Date</Label>
          <Input
            type="date"
            value={drawerFilters.onDate}
            onChange={(e) =>
              setDrawerFilters((p) => ({ ...p, onDate: e.target.value }))
            }
            className="bg-background"
          />
          <span className="text-xs text-muted-foreground">
            Shows bookings starting exactly on this date — overrides the range below.
          </span>
        </div>

        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>From Date</Label>
          <Input
            type="date"
            value={drawerFilters.fromDate}
            onChange={(e) => setDrawerFilters((p) => ({ ...p, fromDate: e.target.value }))}
            className="bg-background"
            disabled={!!drawerFilters.onDate}
          />
        </div>

        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>To Date</Label>
          <Input
            type="date"
            value={drawerFilters.toDate}
            onChange={(e) => setDrawerFilters((p) => ({ ...p, toDate: e.target.value }))}
            className="bg-background"
            disabled={!!drawerFilters.onDate}
          />
        </div>
      </FilterDrawer>

      {/* ── Modals ── */}
      {showModal && !editRecord && (
        <TripBookingsModal
          mode="create"
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
          vehicles={vehicles}
        />
      )}
      {showModal && editRecord && (
        <TripBookingsModal
          mode="edit"
          record={editRecord}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditRecord(null);
          }}
          onSuccess={handleSuccess}
          vehicles={vehicles}
        />
      )}

      {completeTarget && (
        <ExternalTripsModal
          mode="create"
          isOpen={!!completeTarget}
          onClose={() => setCompleteTarget(null)}
          onSuccess={handleSuccess}
          vehicles={vehicles}
          bookingId={completeTarget.id}
          prefill={{
            customerName: completeTarget.customer_name,
            customerPhone: completeTarget.customer_phone || undefined,
            fromLocation: completeTarget.from_location,
            toLocation: completeTarget.to_location,
            startDate: completeTarget.start_date,
            endDate: completeTarget.end_date || undefined,
            vehicleId: completeTarget.vehicle_id || undefined,
            driverId: completeTarget.driver_id || undefined,
            quotedAmount: completeTarget.quoted_amount,
            advanceAmount: completeTarget.advance_amount,
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          setCancelError(null);
        }}
        onConfirm={handleCancel}
        title="Cancel Booking"
        description={`Are you sure you want to cancel the booking for ${cancelTarget?.customer_name || "this customer"}? This action cannot be undone.`}
        confirmText="Cancel Booking"
        isLoading={cancelLoading}
        error={cancelError}
      />
    </div>
  );
}
