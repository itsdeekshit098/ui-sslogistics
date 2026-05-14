"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  Zap,
  Settings,
  Trash2,
  Pencil,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { Pagination } from "@/components/pagination";
import { ConfirmModal } from "@/components/confirmModal";
import { RepairModal } from "@/components/repairModal";
import { Typeahead } from "@/components/typeahead";
import { useAuth } from "@/context/AuthContext";
import type { Vehicle } from "@/app/admin/vehicles/vehicles.types";
import type {
  RepairRecordWithVehicle,
  RepairSummary,
  RepairCategory,
  RepairStatus,
} from "./repairRecordsPage.types";
import * as styles from "./repairRecordsPage.style";

const DEFAULT_PAGE_SIZE = 10;

const fmtCurrency = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function RepairRecordsPage() {
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const canWrite = userRole === "admin" || userRole === "staff";

  // ─── Data State ───
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [records, setRecords] = useState<RepairRecordWithVehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [category, setCategory] = useState<RepairCategory | "">("");
  const [status, setStatus] = useState<RepairStatus | "">("");
  const [summary, setSummary] = useState<RepairSummary>({
    totalCount: 0,
    totalCost: 0,
    electricalCost: 0,
    mechanicalCost: 0,
    openCount: 0,
    closedCount: 0,
  });

  // ─── Loading / Error ───
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Skip summary on page-only changes
  const skipSummaryRef = useRef(false);

  // ─── Drawer State ───
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFilters, setDrawerFilters] = useState({
    fromDate: "",
    toDate: "",
    category: "" as RepairCategory | "",
    status: "" as RepairStatus | "",
  });

  // ─── Modal State ───
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editRecord, setEditRecord] = useState<RepairRecordWithVehicle | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] =
    useState<RepairRecordWithVehicle | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ─── Fetch vehicles ───
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await fetch("/api/vehicles");
        if (!res.ok) throw new Error("Failed to fetch vehicles");
        const json = await res.json();
        setVehicles(json.data?.data ?? []);
      } catch {
        setError("Failed to load vehicles");
      } finally {
        setVehiclesLoading(false);
      }
    };
    fetchVehicles();
  }, []);

  // ─── Fetch records ───
  const fetchRecords = useCallback(async () => {
    if (!selectedVehicleId) {
      setRecords([]);
      setTotal(0);
      return;
    }
    const includeSummary = !skipSummaryRef.current;
    skipSummaryRef.current = false;

    setRecordsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        vehicle_id: selectedVehicleId,
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      if (!includeSummary) params.set("include_summary", "false");

      const res = await fetch(`/api/repair-records?${params}`);
      if (!res.ok) throw new Error("Failed to fetch repair records");
      const json = await res.json();
      const result = json.data ?? {};
      setRecords(result.data ?? []);
      setTotal(result.total ?? 0);
      if (result.summary) {
        setSummary(result.summary);
      }
    } catch {
      setError("Failed to load repair records");
      setRecords([]);
      setTotal(0);
    } finally {
      setRecordsLoading(false);
    }
  }, [selectedVehicleId, page, pageSize, fromDate, toDate, category, status]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ─── Vehicle select handler ───
  const handleVehicleChange = (id: string) => {
    setSelectedVehicleId(id);
    setPage(1);
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setCategory("");
    setStatus("");
    setDrawerFilters({ fromDate: "", toDate: "", category: "", status: "" });
  };

  // ─── Drawer handlers ───
  const openDrawer = () => {
    setDrawerFilters({ fromDate, toDate, category, status });
    setDrawerOpen(true);
  };

  const applyDrawerFilters = () => {
    setFromDate(drawerFilters.fromDate);
    setToDate(drawerFilters.toDate);
    setCategory(drawerFilters.category);
    setStatus(drawerFilters.status);
    setPage(1);
    setDrawerOpen(false);
  };

  const clearAllFilters = () => {
    setFromDate("");
    setToDate("");
    setCategory("");
    setStatus("");
    setDrawerFilters({ fromDate: "", toDate: "", category: "", status: "" });
    setPage(1);
    setDrawerOpen(false);
  };

  const activeFilterCount = [fromDate, toDate, category, status].filter(
    Boolean,
  ).length;
  const hasActiveFilters = activeFilterCount > 0;

  // ─── Open modals ───
  const openCreate = () => {
    setModalMode("create");
    setEditRecord(null);
    setModalOpen(true);
  };

  const openEdit = (record: RepairRecordWithVehicle) => {
    setModalMode("edit");
    setEditRecord(record);
    setModalOpen(true);
  };

  // ─── Delete handler ───
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/repair-records?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete record");
      } else {
        setDeleteTarget(null);
        fetchRecords();
      }
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Client-side search filter ───
  const filteredRecords = searchQuery
    ? records.filter((r) => {
        const q = searchQuery.toLowerCase();
        return (
          r.issues.some((i) => i.toLowerCase().includes(q)) ||
          r.category.toLowerCase().includes(q) ||
          (r.technicians?.name &&
            r.technicians.name.toLowerCase().includes(q)) ||
          (r.description && r.description.toLowerCase().includes(q))
        );
      })
    : records;

  const selectedVehicle = vehicles.find(
    (v) => v.id.toString() === selectedVehicleId,
  );

  return (
    <div className="container mx-auto space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Repair Records
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            View and manage vehicle repair history.
          </p>
        </div>
        {canWrite && (
          <Button
            className="w-full md:w-auto"
            onClick={openCreate}
            disabled={vehiclesLoading || !!error}
          >
            {vehiclesLoading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {vehiclesLoading ? "Loading Vehicles..." : "Add Repair Record"}
          </Button>
        )}
      </div>

      {/* Vehicle Selector */}
      <div className="w-full sm:w-80">
        <Typeahead
          id="repairVehicleFilter"
          options={vehicles}
          value={selectedVehicleId}
          onValueChange={handleVehicleChange}
          getOptionValue={(v) => v.id.toString()}
          getOptionLabel={(v) =>
            `${v.vehicle_number} — ${v.company} ${v.model}`.trim()
          }
          getOptionKeywords={(v) => [v.vehicle_number, v.company, v.model]}
          placeholder={vehiclesLoading ? "Loading vehicles..." : "Select a vehicle..."}
          emptyMessage="No vehicles found."
          disabled={vehiclesLoading}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm border border-destructive/20">
          {error}
        </div>
      )}

      {/* Summary Strip */}
      {selectedVehicleId && summary.totalCount > 0 && (
        <div
          style={{
            ...styles.summaryStrip,
            opacity: recordsLoading ? 0.5 : 1,
            transition: "opacity 0.2s ease",
          }}
        >
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Repairs</span>
            <span style={styles.summaryValue}>{summary.totalCount}</span>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Cost</span>
            <span style={styles.summaryValue}>
              {fmtCurrency(summary.totalCost)}
            </span>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Electrical</span>
            <span style={styles.summaryValue}>
              {fmtCurrency(summary.electricalCost)}
            </span>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Mechanical</span>
            <span style={styles.summaryValue}>
              {fmtCurrency(summary.mechanicalCost)}
            </span>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Open</span>
            <span style={styles.summaryValue}>{summary.openCount}</span>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Closed</span>
            <span style={styles.summaryValue}>{summary.closedCount}</span>
          </div>
        </div>
      )}

      {/* Records Card */}
      {selectedVehicleId && (
        <Card>
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg md:text-xl">
                Repair History for {selectedVehicle?.vehicle_number}
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-52">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search records..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={openDrawer}
                  className="gap-2"
                >
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
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
            {/* ─── Mobile Card View ─── */}
            <div className="block md:hidden space-y-3">
              {recordsLoading ? (
                <LoadingSpinner size="md" centered label="Loading records..." />
              ) : filteredRecords.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No records found.
                </p>
              ) : (
                filteredRecords.map((record) => (
                  <div
                    key={record.id}
                    className="border rounded-lg p-3 space-y-2 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => isAdmin && openEdit(record)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {record.repair_date.split("T")[0]}
                      </span>
                      <Badge
                        variant={
                          record.status === "Closed" ? "success" : "warning"
                        }
                      >
                        {record.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground capitalize">
                      {record.category === "electrical" ? (
                        <Zap className="h-3.5 w-3.5 text-yellow-500" />
                      ) : (
                        <Settings className="h-3.5 w-3.5 text-slate-500" />
                      )}
                      {record.category}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {record.issues.map((issue) => (
                        <Badge
                          key={issue}
                          variant="secondary"
                          className="text-xs"
                        >
                          {issue}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Cost: ₹{Number(record.cost).toLocaleString()}
                      {record.technicians?.name &&
                        ` • Tech: ${record.technicians.name}`}
                    </div>
                    {isAdmin && (
                      <div className="flex justify-end pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(record);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* ─── Desktop Table View ─── */}
            <div className="hidden md:block rounded-md border border-border overflow-x-auto overflow-y-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordsLoading ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 8 : 7}>
                        <LoadingSpinner
                          size="sm"
                          centered
                          label="Loading records..."
                        />
                      </TableCell>
                    </TableRow>
                  ) : filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 8 : 7}
                        className="text-center"
                      >
                        No records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((record) => (
                      <TableRow
                        key={record.id}
                        className={
                          isAdmin
                            ? "cursor-pointer hover:bg-muted/50 transition-colors"
                            : ""
                        }
                        onClick={() => isAdmin && openEdit(record)}
                      >
                        <TableCell>
                          {record.repair_date.split("T")[0]}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 capitalize">
                            {record.category === "electrical" ? (
                              <Zap className="h-4 w-4 text-yellow-500" />
                            ) : (
                              <Settings className="h-4 w-4 text-slate-500" />
                            )}
                            {record.category}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {record.issues.map((issue) => (
                              <Badge
                                key={issue}
                                variant="secondary"
                                className="text-xs"
                              >
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell
                          className="max-w-xs truncate"
                          title={record.description || ""}
                        >
                          {record.description || "—"}
                        </TableCell>
                        <TableCell>
                          ₹{Number(record.cost).toLocaleString()}
                        </TableCell>
                        <TableCell>{record.technicians?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              record.status === "Closed" ? "success" : "warning"
                            }
                          >
                            {record.status}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => openEdit(record)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(record)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="mt-4">
                <Pagination
                  page={page}
                  totalCount={total}
                  pageSize={pageSize}
                  onPageChange={(p) => {
                    skipSummaryRef.current = true;
                    setPage(p);
                  }}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                <label style={styles.drawerFieldLabel}>Category</label>
                <select
                  value={drawerFilters.category}
                  onChange={(e) =>
                    setDrawerFilters((p) => ({
                      ...p,
                      category: e.target.value as RepairCategory | "",
                    }))
                  }
                  style={styles.drawerSelect}
                >
                  <option value="">All Categories</option>
                  <option value="electrical">Electrical</option>
                  <option value="mechanical">Mechanical</option>
                </select>
              </div>

              <div style={styles.drawerFieldGroup}>
                <label style={styles.drawerFieldLabel}>Status</label>
                <select
                  value={drawerFilters.status}
                  onChange={(e) =>
                    setDrawerFilters((p) => ({
                      ...p,
                      status: e.target.value as RepairStatus | "",
                    }))
                  }
                  style={styles.drawerSelect}
                >
                  <option value="">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
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

      {/* ─── Create / Edit Modal ─── */}
      {modalMode === "create" ? (
        <RepairModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchRecords}
          vehicles={vehicles}
          mode="create"
        />
      ) : (
        editRecord && (
          <RepairModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            onSuccess={fetchRecords}
            vehicles={vehicles}
            mode="edit"
            record={editRecord}
          />
        )
      )}

      {/* ─── Delete Confirm Modal ─── */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Delete Repair Record"
        description={`Are you sure you want to delete this ${deleteTarget?.category} repair record? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
