"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  TruckIcon,
  SlidersHorizontalIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { canEdit as canEditRole, isAdmin as isAdminRole } from "@/lib/routePermissions";
import {
  TRIP_TYPE_LABELS,
  getDefaultExternalTripFilters,
} from "./externalTripsPage.types";
import type {
  TripType,
  ExternalTripWithDetails,
  ExternalTripFilters,
  ExternalTripSummary,
} from "./externalTripsPage.types";
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
import { Typeahead } from "@/components/typeahead";
import { FilterDrawer, fieldGroup as filterFieldGroup, fieldLabel as filterFieldLabel } from "@/components/ui/filterDrawer";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { Pagination } from "@/components/pagination";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { DataTable } from "@/components/ui/dataTable/dataTable";
import type { ColumnDef, RowAction } from "@/components/ui/dataTable/dataTable.types";
import * as styles from "./externalTripsPage.style";

// Lazy-loaded: only needed once a user opens one of these modals, so they
// shouldn't bloat the initial page chunk that has to load before anything
// (including the skeleton) can paint.
const ExternalTripsModal = dynamic(
  () => import("../externalTripsModal").then((m) => m.ExternalTripsModal),
  { ssr: false },
);
const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);

export function ExternalTripsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const canEdit = canEditRole(userRole);
  // Edit/delete are admin-tier only (staff can add but not modify existing records).
  const canManage = isAdminRole(userRole);

  const [trips, setTrips] = useState<ExternalTripWithDetails[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ExternalTripFilters>(
    getDefaultExternalTripFilters,
  );
  const [summary, setSummary] = useState<ExternalTripSummary>({
    totalCost: 0,
    totalReceived: 0,
    totalProfit: 0,
    count: 0,
  });
  const [totalRecords, setTotalRecords] = useState(0);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFilters, setDrawerFilters] = useState<ExternalTripFilters>(
    getDefaultExternalTripFilters,
  );

  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState<ExternalTripWithDetails | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] =
    useState<ExternalTripWithDetails | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ─── API URL builder ───
  const buildApiUrl = useCallback(
    (f: ExternalTripFilters, includeSummary = true) => {
      const p = new URLSearchParams();
      if (f.fromDate) p.set("from_date", f.fromDate);
      if (f.toDate) p.set("to_date", f.toDate);
      if (f.vehicleId) p.set("vehicle_id", f.vehicleId);
      if (f.tripType !== "all") p.set("trip_type", f.tripType);
      p.set("page", String(f.page));
      p.set("page_size", String(f.pageSize));
      if (!includeSummary) p.set("include_summary", "false");
      return `/api/external-trips?${p.toString()}`;
    },
    []
  );

  // ─── Fetch trips ───
  const fetchTrips = useCallback(
    async (
      f: ExternalTripFilters,
      opts: { isInitial?: boolean; includeSummary?: boolean } = {}
    ) => {
      const { isInitial = false, includeSummary = true } = opts;
      try {
        if (isInitial) setInitialLoading(true);
        else setFetching(true);
        setError(null);
        const res = await fetch(buildApiUrl(f, includeSummary));
        if (!res.ok) throw new Error("Failed to fetch trips");
        const json = await res.json();
        const result = json.data ?? {};
        setTrips(result.data || []);
        setTotalRecords(result.total ?? 0);
        if (result.summary) {
          setSummary(result.summary);
        }
        setFilters(f);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        setTrips([]);
        setTotalRecords(0);
      } finally {
        setInitialLoading(false);
        setFetching(false);
      }
    },
    [buildApiUrl]
  );

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/vehicles");
      if (res.ok) {
        const json = await res.json();
        setVehicles(json.data?.data ?? []);
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchTrips(filters, { isInitial: true });
      fetchVehicles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // ─── Drawer helpers ───
  const openDrawer = () => {
    setDrawerFilters({ ...filters });
    setDrawerOpen(true);
  };

  const applyDrawerFilters = () => {
    const next: ExternalTripFilters = {
      ...drawerFilters,
      page: 1,
    };
    fetchTrips(next);
    setDrawerOpen(false);
  };

  const clearAllFilters = () => {
    const defaults = getDefaultExternalTripFilters();
    setDrawerFilters(defaults);
    fetchTrips(defaults);
    setDrawerOpen(false);
  };

  const handlePageChange = (page: number) => {
    const next = { ...filters, page };
    fetchTrips(next, { includeSummary: false });
  };

  const handlePageSizeChange = (size: number) => {
    const next = { ...filters, pageSize: size, page: 1 };
    fetchTrips(next);
  };

  const handleSuccess = async () => {
    await fetchTrips(filters);
  };
  const handleEdit = (d: ExternalTripWithDetails) => {
    setEditRecord(d);
    setShowModal(true);
  };
  const handleAddNew = () => {
    setEditRecord(null);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/external-trips?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        setDeleteError(d.error || "Failed to delete");
      } else {
        await fetchTrips(filters);
        setDeleteTarget(null);
      }
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const displayData = trips;

  const activeFilterCount = [
    filters.fromDate,
    filters.toDate,
    filters.vehicleId,
    filters.tripType !== "all" ? filters.tripType : "",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const fmtCurrency = (v: number) => `₹${Number(v).toLocaleString("en-IN")}`;
  const profitStyle = (p: number) =>
    p > 0
      ? styles.profitPositive
      : p < 0
        ? styles.profitNegative
        : styles.profitNeutral;

  // DataTable columns definition
  const columns: ColumnDef<ExternalTripWithDetails>[] = [
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (trip) => (
        <span className="font-medium text-foreground whitespace-nowrap">
          {trip.vehicles?.vehicle_number || "—"}
        </span>
      ),
    },
    {
      key: "trip_type",
      header: "Trip Type",
      cell: (trip) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap ${
            trip.trip_type === "company_oncall"
              ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20"
              : "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/20"
          }`}
        >
          {TRIP_TYPE_LABELS[trip.trip_type]}
        </span>
      ),
    },
    {
      key: "route",
      header: "Route",
      cell: (trip) => {
        const route = [trip.from_location, trip.to_location]
          .filter(Boolean)
          .join(" → ");
        return (
          <span className="text-muted-foreground max-w-[180px] truncate block" title={route}>
            {route || "—"}
          </span>
        );
      },
    },
    {
      key: "driver",
      header: "Driver",
      cell: (trip) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {trip.drivers?.name || "—"}
        </span>
      ),
    },
    {
      key: "start_date",
      header: "Start Date",
      cell: (trip) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {trip.start_date || "—"}
        </span>
      ),
    },
    {
      key: "total_cost",
      header: "Cost",
      align: "right",
      cell: (trip) => (
        <span className="font-medium text-foreground whitespace-nowrap">
          {fmtCurrency(trip.total_cost)}
        </span>
      ),
    },
    {
      key: "amount_received",
      header: "Received",
      align: "right",
      cell: (trip) => (
        <span className="font-medium text-foreground whitespace-nowrap">
          {fmtCurrency(trip.amount_received || 0)}
        </span>
      ),
    },
    {
      key: "profit",
      header: "Profit",
      align: "right",
      cell: (trip) => {
        const profit = (trip.amount_received || 0) - (trip.total_cost || 0);
        return (
          <span className="font-semibold whitespace-nowrap" style={profitStyle(profit)}>
            {profit >= 0 ? "+" : ""}
            {fmtCurrency(profit)}
          </span>
        );
      },
    },
  ];

  const rowActions: RowAction<ExternalTripWithDetails>[] = [
    {
      key: "edit",
      label: "Edit",
      icon: <PencilIcon size={14} />,
      hidden: () => !canManage,
      onClick: handleEdit,
    },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2Icon size={14} />,
      variant: "danger",
      hidden: () => !canManage,
      onClick: (trip) => setDeleteTarget(trip),
    },
  ];

  if (authLoading || initialLoading)
    return <PageLoadingSkeleton variant="admin" />;
  if (error && trips.length === 0)
    return (
      <ErrorState
        title="Error"
        description={error}
        onRetry={() => fetchTrips(filters, { isInitial: true })}
      />
    );

  return (
    <div className="container mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            External Trips
          </h1>
          <p className="text-muted-foreground mt-1">
            Track every vehicle trip, expenses, and revenue
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleAddNew} className="w-full sm:w-auto">
            <PlusIcon size={16} style={{ marginRight: "0.5rem" }} /> New Trip
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col min-h-[500px]">

        {/* ── Summary Strip ── */}
        {summary.count > 0 && (
          <div className="px-4 sm:px-6 pt-4">
            <div
              style={{
                ...styles.summaryStrip,
                opacity: fetching ? 0.5 : 1,
                transition: "opacity 0.2s ease",
              }}
            >
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Trips</span>
                <span style={styles.summaryValue}>{summary.count}</span>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Total Cost</span>
                <span style={styles.summaryValue}>
                  {fmtCurrency(summary.totalCost)}
                </span>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Total Received</span>
                <span style={styles.summaryValue}>
                  {fmtCurrency(summary.totalReceived)}
                </span>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Profit</span>
                <span
                  style={{
                    ...styles.summaryValue,
                    ...profitStyle(summary.totalProfit),
                  }}
                >
                  {summary.totalProfit >= 0 ? "+" : ""}
                  {fmtCurrency(summary.totalProfit)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        <div className="flex-1 p-4 sm:p-6">
          {/* Filter Button — right-aligned above table */}
          <div className="flex items-center justify-end gap-2 mb-4">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-primary"
              >
                Clear all
              </Button>
            )}
            <Button variant="outline" onClick={openDrawer} className="gap-2">
              <SlidersHorizontalIcon size={16} />
              Filters
              {activeFilterCount > 0 && (
                <span style={styles.activeFilterBadge}>
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {error ? (
            <ErrorState
              title="Couldn't load trips"
              description={error}
              onRetry={() => fetchTrips(filters)}
            />
          ) : !fetching && displayData.length === 0 ? (
            <EmptyState
              title="No trips found"
              description={
                hasActiveFilters
                  ? "Try adjusting your filters."
                  : "Get started by recording your first trip."
              }
              actionLabel={
                hasActiveFilters
                  ? "Clear Filters"
                  : "New Trip"
              }
              onAction={
                hasActiveFilters
                  ? clearAllFilters
                  : handleAddNew
              }
              icon={TruckIcon}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <DataTable
                  columns={columns}
                  data={displayData}
                  rowKey={(t) => String(t.id)}
                  loading={fetching}
                  showActions={canManage}
                  rowActions={rowActions}
                />
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {fetching ? (
                  <LoadingSpinner size="md" centered label="Loading trips..." />
                ) : (
                  displayData.map((trip) => {
                    const route = [trip.from_location, trip.to_location]
                      .filter(Boolean)
                      .join(" → ");
                    const profit =
                      (trip.amount_received || 0) - (trip.total_cost || 0);
                    return (
                      <div
                        key={trip.id}
                        className="rounded-lg border bg-card p-4 shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-foreground text-lg">
                              {trip.vehicles?.vehicle_number || "—"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {trip.customer_name || "No customer"}
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              trip.trip_type === "company_oncall"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                                : "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400"
                            }`}
                          >
                            {TRIP_TYPE_LABELS[trip.trip_type]}
                          </span>
                        </div>
                        {route && (
                          <div className="text-sm text-muted-foreground mb-1">
                            📍 {route}
                          </div>
                        )}
                        {trip.drivers?.name && (
                          <div className="text-sm text-muted-foreground mb-1">
                            🚗 {trip.drivers.name}
                          </div>
                        )}
                        {trip.customer_phone && (
                          <div className="text-sm text-muted-foreground mb-1">
                            📞 {trip.customer_phone}
                          </div>
                        )}
                        {trip.start_date && (
                          <div className="text-sm text-muted-foreground mb-1">
                            📅 {trip.start_date}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2 mb-3 gap-4">
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Cost
                            </div>
                            <div className="text-base font-semibold text-foreground">
                              {fmtCurrency(trip.total_cost)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Received
                            </div>
                            <div className="text-base font-semibold text-foreground">
                              {fmtCurrency(trip.amount_received || 0)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Profit
                            </div>
                            <div
                              className="text-base font-bold"
                              style={profitStyle(profit)}
                            >
                              {profit >= 0 ? "+" : ""}
                              {fmtCurrency(profit)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t pt-3">
                          {canManage && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(trip)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteTarget(trip)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
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
      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApply={applyDrawerFilters}
      >
        {/* Trip Type — Radix Select */}
        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>Trip Type</Label>
          <Select
            value={drawerFilters.tripType}
            onValueChange={(v) =>
              setDrawerFilters((p) => ({
                ...p,
                tripType: v as TripType | "all",
              }))
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All Trip Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trip Types</SelectItem>
              {(
                Object.entries(TRIP_TYPE_LABELS) as [TripType, string][]
              ).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vehicle — Typeahead */}
        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>Vehicle</Label>
          <Typeahead
            options={vehicles}
            value={drawerFilters.vehicleId}
            onValueChange={(vehicleId) =>
              setDrawerFilters((p) => ({
                ...p,
                vehicleId,
              }))
            }
            getOptionValue={(v) => v.id.toString()}
            getOptionLabel={(v) =>
              `${v.vehicle_number} — ${v.company} ${v.model}`.trim()
            }
            getOptionKeywords={(v) => [
              v.vehicle_number,
              v.company,
              v.model,
            ]}
            placeholder="Search vehicle..."
            emptyMessage="No vehicles found."
          />
        </div>

        {/* From Date */}
        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>From Date</Label>
          <Input
            type="date"
            value={drawerFilters.fromDate}
            onChange={(e) =>
              setDrawerFilters((p) => ({
                ...p,
                fromDate: e.target.value,
              }))
            }
            className="bg-background"
          />
        </div>

        {/* To Date */}
        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>To Date</Label>
          <Input
            type="date"
            value={drawerFilters.toDate}
            onChange={(e) =>
              setDrawerFilters((p) => ({
                ...p,
                toDate: e.target.value,
              }))
            }
            className="bg-background"
          />
        </div>
      </FilterDrawer>

      {/* ── Modals ── */}
      {showModal && !editRecord && (
        <ExternalTripsModal
          mode="create"
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
          vehicles={vehicles}
        />
      )}
      {showModal && editRecord && (
        <ExternalTripsModal
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
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Delete Trip"
        description={`Are you sure you want to delete this trip for ${deleteTarget?.vehicles?.vehicle_number || "this vehicle"}? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
