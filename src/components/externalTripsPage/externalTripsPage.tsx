"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Truck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
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
import { ExternalTripsModal } from "../externalTripsModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/confirmModal/confirmModal";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { Pagination } from "@/components/pagination";
import { LoadingSpinner } from "@/components/loadingSpinner";
import * as styles from "./externalTripsPage.style";

export function ExternalTripsPage() {
  const { userRole, loading: authLoading } = useAuth();

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
    [],
  );

  // ─── Fetch trips ───
  const fetchTrips = useCallback(
    async (
      f: ExternalTripFilters,
      opts: { isInitial?: boolean; includeSummary?: boolean } = {},
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
        // Sync filters only on success
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
    [buildApiUrl],
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
      search: filters.search,
    };
    fetchTrips(next);
    setDrawerOpen(false);
  };

  const clearAllFilters = () => {
    const defaults = getDefaultExternalTripFilters();
    setDrawerFilters(defaults);
    fetchTrips({ ...defaults, search: filters.search });
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

  // ─── Client-side search ───
  const displayData = filters.search
    ? trips.filter((d) => {
        const q = filters.search.toLowerCase();
        return (
          (d.vehicles?.vehicle_number?.toLowerCase() || "").includes(q) ||
          (d.customer_name?.toLowerCase() || "").includes(q) ||
          (d.drivers?.name?.toLowerCase() || "").includes(q)
        );
      })
    : trips;

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
    <div className="container mx-auto space-y-6 md:space-y-8">
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
        <Button onClick={handleAddNew} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> New Trip
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm flex flex-col min-h-[500px] overflow-hidden">
        {/* ── Top Bar: Search + Filter Button ── */}
        <div className="p-4 sm:p-6 border-b border-border">
          <div style={styles.topBar}>
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vehicle, customer, driver..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="pl-9 pr-9 bg-background"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, search: "" }))
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" onClick={openDrawer} className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span style={styles.activeFilterBadge}>
                  {activeFilterCount}
                </span>
              )}
            </Button>
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
          </div>
        </div>

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
          {fetching ? (
            <LoadingSpinner size="md" centered label="Loading trips..." />
          ) : error ? (
            <ErrorState
              title="Couldn't load trips"
              description={error}
              onRetry={() => fetchTrips(filters)}
            />
          ) : displayData.length === 0 ? (
            <EmptyState
              title="No trips found"
              description={
                hasActiveFilters || filters.search
                  ? "Try adjusting your filters."
                  : "Get started by recording your first trip."
              }
              actionLabel={
                hasActiveFilters || filters.search
                  ? "Clear Filters"
                  : "New Trip"
              }
              onAction={
                hasActiveFilters || filters.search
                  ? clearAllFilters
                  : handleAddNew
              }
              icon={Truck}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block rounded-md border border-border overflow-x-auto overflow-y-hidden">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="h-12 px-4 text-left font-medium whitespace-nowrap">
                        Vehicle
                      </th>
                      <th className="h-12 px-4 text-left font-medium whitespace-nowrap">
                        Trip Type
                      </th>
                      <th className="h-12 px-4 text-left font-medium">Route</th>
                      <th className="h-12 px-4 text-left font-medium">
                        Driver
                      </th>
                      <th className="h-12 px-4 text-left font-medium whitespace-nowrap">
                        Start Date
                      </th>
                      <th className="h-12 px-4 text-right font-medium">Cost</th>
                      <th className="h-12 px-4 text-right font-medium">
                        Received
                      </th>
                      <th className="h-12 px-4 text-right font-medium">
                        Profit
                      </th>
                      {userRole === "admin" && (
                        <th className="h-12 px-4 text-left font-medium">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {displayData.map((trip) => {
                      const route = [trip.from_location, trip.to_location]
                        .filter(Boolean)
                        .join(" → ");
                      const profit =
                        (trip.amount_received || 0) - (trip.total_cost || 0);
                      return (
                        <tr
                          key={trip.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                            {trip.vehicles?.vehicle_number || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap ${trip.trip_type === "company_oncall" ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20" : "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/20"}`}
                            >
                              {TRIP_TYPE_LABELS[trip.trip_type]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">
                            {route || "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {trip.drivers?.name || "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {trip.start_date || "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                            {fmtCurrency(trip.total_cost)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                            {fmtCurrency(trip.amount_received || 0)}
                          </td>
                          <td
                            className="px-4 py-3 text-right font-semibold whitespace-nowrap"
                            style={profitStyle(profit)}
                          >
                            {profit >= 0 ? "+" : ""}
                            {fmtCurrency(profit)}
                          </td>
                          {userRole === "admin" && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                                  onClick={() => handleEdit(trip)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteTarget(trip)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {displayData.map((trip) => {
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
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${trip.trip_type === "company_oncall" ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" : "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400"}`}
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
                        {userRole === "admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(trip)}
                          >
                            Edit
                          </Button>
                        )}
                        {userRole === "admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(trip)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
      {drawerOpen && (
        <>
          <div style={styles.drawerContainer}>
            <div style={styles.drawerHeader}>
              <span style={styles.drawerTitle}>Filters</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.25rem",
                  color: "var(--foreground)",
                }}
              >
                <X style={{ width: "1.25rem", height: "1.25rem" }} />
              </button>
            </div>

            <div style={styles.drawerBody} className="scrollbar-custom">
              <div style={styles.drawerFieldGroup}>
                <label style={styles.drawerFieldLabel}>Trip Type</label>
                <select
                  value={drawerFilters.tripType}
                  onChange={(e) =>
                    setDrawerFilters((p) => ({
                      ...p,
                      tripType: e.target.value as TripType | "all",
                    }))
                  }
                  style={styles.drawerSelect}
                >
                  <option value="all">All Trip Types</option>
                  {(
                    Object.entries(TRIP_TYPE_LABELS) as [TripType, string][]
                  ).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.drawerFieldGroup}>
                <label style={styles.drawerFieldLabel}>Vehicle</label>
                <select
                  value={drawerFilters.vehicleId}
                  onChange={(e) =>
                    setDrawerFilters((p) => ({
                      ...p,
                      vehicleId: e.target.value,
                    }))
                  }
                  style={styles.drawerSelect}
                >
                  <option value="">All Vehicles</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id.toString()}>
                      {v.vehicle_number} — {v.company} {v.model}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.drawerFieldGroup}>
                <label style={styles.drawerFieldLabel}>From Date</label>
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

              <div style={styles.drawerFieldGroup}>
                <label style={styles.drawerFieldLabel}>To Date</label>
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
            </div>

            <div style={styles.drawerFooter}>
              <Button
                variant="outline"
                onClick={() => setDrawerOpen(false)}
                className="flex-1"
              >
                Close
              </Button>
              <Button onClick={applyDrawerFilters} className="flex-1">
                Apply Filters
              </Button>
            </div>
          </div>
        </>
      )}

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
