"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  PlusIcon,
  ZapIcon,
  SettingsIcon,
  Trash2Icon,
  PencilIcon,
  SlidersHorizontalIcon,
  InboxIcon,
  FolderOpenIcon,
  CheckCircleIcon,
  DownloadIcon,
} from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/dataTable";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { CardListSkeleton } from "@/components/skeletonLoader";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";
import { Pagination } from "@/components/pagination";
import { Typeahead } from "@/components/typeahead";
import { FilterDrawer, fieldGroup as filterFieldGroup, fieldLabel as filterFieldLabel } from "@/components/ui/filterDrawer";
import { useAuth } from "@/context/AuthContext";
import { canEdit as canEditRole, isAdmin as isAdminRole } from "@/lib/routePermissions";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/statCard";
import type { Vehicle } from "@/app/admin/vehicles/vehicles.types";
import type {
  Technician,
  SpecializationOption,
} from "@/components/techniciansPage";
import type {
  RepairRecordWithVehicle,
  RepairSummary,
  RepairCategory,
  RepairStatus,
} from "./repairRecordsPage.types";
import * as styles from "./repairRecordsPage.style";

// Lazy-loaded: only needed once a user opens one of these modals, so they
// shouldn't bloat the initial page chunk that has to load before anything
// (including the skeleton) can paint.
const ConfirmModal = dynamic(
  () => import("@/components/confirmModal").then((m) => m.ConfirmModal),
  { ssr: false },
);
const RepairModal = dynamic(
  () => import("@/components/repairModal").then((m) => m.RepairModal),
  { ssr: false },
);

const DEFAULT_PAGE_SIZE = 10;

const fmtCurrency = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function RepairRecordsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const canEdit = canEditRole(userRole);
  // Edit/delete are admin-tier only (staff can add but not modify existing records).
  const canManage = isAdminRole(userRole);

  // ─── Data State ───
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [specializations, setSpecializations] = useState<
    SpecializationOption[]
  >([]);
  const [repairOptions, setRepairOptions] = useState<Record<string, string[]>>({
    electrical: [],
    mechanical: [],
  });
  const [records, setRecords] = useState<RepairRecordWithVehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
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
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const msgTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (msgTimeoutRef.current) clearTimeout(msgTimeoutRef.current); }, []);

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

  // ─── Fetch Reference Data ───
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const [vehiclesRes, techRes, specRes, issuesRes] = await Promise.all([
          fetch("/api/vehicles")
            .then((r) => r.json())
            .catch(() => ({ data: { data: [] } })),
          fetch("/api/technicians?include_inactive=true&pageSize=1000")
            .then((r) => r.json())
            .catch(() => ({ data: { data: [] } })),
          fetch("/api/specializations")
            .then((r) => r.json())
            .catch(() => ({ data: [] })),
          fetch("/api/repair-issues")
            .then((r) => r.json())
            .catch(() => ({ data: null })),
        ]);

        setVehicles(vehiclesRes?.data?.data ?? []);
        if (techRes?.data?.data && Array.isArray(techRes.data.data)) {
          setTechnicians(techRes.data.data);
        }
        if (specRes?.data && Array.isArray(specRes.data)) {
          setSpecializations(specRes.data);
        }
        if (issuesRes?.success && issuesRes.data) {
          setRepairOptions(issuesRes.data);
        }
      } catch {
        setError("Failed to load page data");
      } finally {
        setVehiclesLoading(false);
      }
    };
    fetchReferenceData();
  }, []);

  // ─── Callbacks for Inline Data Creation ───
  const handleIssueAdded = useCallback(
    (category: string, issueName: string) => {
      setRepairOptions((prev) => ({
        ...prev,
        [category]: [...(prev[category] || []), issueName],
      }));
    },
    [],
  );

  const handleTechnicianAdded = useCallback((newTech: Technician) => {
    setTechnicians((prev) => [...prev, newTech]);
  }, []);

  const handleSpecializationAdded = useCallback(
    (newSpec: SpecializationOption) => {
      setSpecializations((prev) => [...prev, newSpec]);
    },
    [],
  );

  // ─── Fetch records ───
  const fetchRecords = useCallback(
    async (opts?: {
      overrideVehicleId?: string;
      overridePage?: number;
      overridePageSize?: number;
      overrideFromDate?: string;
      overrideToDate?: string;
      overrideCategory?: RepairCategory | "";
      overrideStatus?: RepairStatus | "";
      skipSummary?: boolean;
    }) => {
      const vid = opts?.overrideVehicleId ?? selectedVehicleId;
      const p = opts?.overridePage ?? page;
      const ps = opts?.overridePageSize ?? pageSize;
      const fd = opts?.overrideFromDate ?? fromDate;
      const td = opts?.overrideToDate ?? toDate;
      const cat = opts?.overrideCategory ?? category;
      const st = opts?.overrideStatus ?? status;
      const includeSummary = !(opts?.skipSummary ?? skipSummaryRef.current);
      skipSummaryRef.current = false;

      // We no longer return early if !vid. An empty vid means "All Vehicles".
      setRecordsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: p.toString(),
          pageSize: ps.toString(),
        });
        if (vid) params.set("vehicle_id", vid);
        if (fd) params.set("from_date", fd);
        if (td) params.set("to_date", td);
        if (cat) params.set("category", cat);
        if (st) params.set("status", st);
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

        // Sync state on success
        setSelectedVehicleId(vid);
        setPage(p);
        setPageSize(ps);
        setFromDate(fd);
        setToDate(td);
        setCategory(cat);
        setStatus(st);
      } catch {
        setError("Failed to load repair records");
        setRecords([]);
        setTotal(0);
      } finally {
        setRecordsLoading(false);
      }
    },
    [selectedVehicleId, page, pageSize, fromDate, toDate, category, status],
  );

  // Initial fetch
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Vehicle select handler ───
  const handleVehicleChange = (id: string) => {
    // Optimistic UI updates
    setSelectedVehicleId(id);
    setPage(1);
    setFromDate("");
    setToDate("");
    setCategory("");
    setStatus("");
    setDrawerFilters({ fromDate: "", toDate: "", category: "", status: "" });
    fetchRecords({
      overrideVehicleId: id,
      overridePage: 1,
      overrideFromDate: "",
      overrideToDate: "",
      overrideCategory: "",
      overrideStatus: "",
    });
  };

  // ─── Drawer handlers ───
  const openDrawer = () => {
    setDrawerFilters({ fromDate, toDate, category, status });
    setDrawerOpen(true);
  };

  const applyDrawerFilters = () => {
    // Optimistic UI updates
    setFromDate(drawerFilters.fromDate);
    setToDate(drawerFilters.toDate);
    setCategory(drawerFilters.category);
    setStatus(drawerFilters.status);
    setPage(1);
    setDrawerOpen(false);
    fetchRecords({
      overridePage: 1,
      overrideFromDate: drawerFilters.fromDate,
      overrideToDate: drawerFilters.toDate,
      overrideCategory: drawerFilters.category,
      overrideStatus: drawerFilters.status,
    });
  };

  const clearAllFilters = () => {
    // Optimistic UI updates
    setFromDate("");
    setToDate("");
    setCategory("");
    setStatus("");
    setPage(1);
    setDrawerFilters({ fromDate: "", toDate: "", category: "", status: "" });
    setDrawerOpen(false);
    fetchRecords({
      overridePage: 1,
      overrideFromDate: "",
      overrideToDate: "",
      overrideCategory: "",
      overrideStatus: "",
    });
  };

  // ─── Export Handler ───
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams();
      if (selectedVehicleId) params.set("vehicle_id", selectedVehicleId);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (category) params.set("category", category);
      if (status) params.set("status", status);

      const res = await fetch(`/api/repair-records/export?${params}`);
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "repair_records.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      if (msgTimeoutRef.current) clearTimeout(msgTimeoutRef.current);
      setSuccessMsg("Download completed successfully.");
      msgTimeoutRef.current = setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      if (msgTimeoutRef.current) clearTimeout(msgTimeoutRef.current);
      setError("Failed to download repair records.");
      msgTimeoutRef.current = setTimeout(() => setError(null), 3000);
    } finally {
      setIsDownloading(false);
    }
  };

  // Page change handlers — set state immediately for visual feedback
  const handlePageChange = (p: number) => {
    setPage(p);
    fetchRecords({ overridePage: p, skipSummary: true });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
    fetchRecords({ overridePageSize: size, overridePage: 1 });
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

  const filteredRecords = records;

  const selectedVehicle = vehicles.find(
    (v) => v.id.toString() === selectedVehicleId,
  );

  if (authLoading) return <PageLoadingSkeleton variant="admin" />;
  if (error && vehicles.length === 0)
    return <ErrorState title="Error" description={error} />;

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
        {canEdit && (
          <Button
            className="w-full md:w-auto"
            onClick={openCreate}
            disabled={vehiclesLoading || !!error}
          >
            {vehiclesLoading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <PlusIcon size={16} style={{ marginRight: "0.5rem" }} />
            )}
            {vehiclesLoading ? "Loading Vehicles..." : "Add Repair Record"}
          </Button>
        )}
      </div>



      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm border border-destructive/20">
          {error}
        </div>
      )}

      {/* Success */}
      {successMsg && (
        <div className="bg-success/10 text-success px-4 py-3 rounded-md text-sm border border-success/20">
          {successMsg}
        </div>
      )}

      {/* Summary KPI Cards Grid */}
      {summary.totalCount > 0 && (
        <div
          style={{
            ...styles.summaryStrip,
            opacity: recordsLoading ? 0.6 : 1,
            transition: "opacity 0.25s ease",
          }}
        >
          {/* Card 1: Total Cost */}
          <StatCard
            title="Total Cost"
            value={fmtCurrency(summary.totalCost)}
            icon={<span style={{ fontSize: "1rem", fontWeight: 700 }}>₹</span>}
            iconBgColor="rgba(59, 130, 246, 0.12)"
            iconColor="#3b82f6"
            highlightColor="#3b82f6"
          />

          {/* Card 2: Total Repairs */}
          <StatCard
            title="Total Repairs"
            value={summary.totalCount}
            icon={<InboxIcon size={14} />}
            iconBgColor="rgba(6, 182, 212, 0.12)"
            iconColor="#06b6d4"
            highlightColor="#06b6d4"
          />

          {/* Card 3: Open Repairs */}
          <StatCard
            title="Open Repairs"
            value={summary.openCount}
            icon={<FolderOpenIcon size={14} />}
            iconBgColor="rgba(245, 158, 11, 0.12)"
            iconColor="#f59e0b"
            highlightColor="#f59e0b"
          />

          {/* Card 4: Closed Repairs */}
          <StatCard
            title="Closed Repairs"
            value={summary.closedCount}
            icon={<CheckCircleIcon size={14} />}
            iconBgColor="rgba(16, 185, 129, 0.12)"
            iconColor="#10b981"
            highlightColor="#10b981"
          />

          {/* Card 5: Electrical */}
          <StatCard
            title="Electrical"
            value={fmtCurrency(summary.electricalCost)}
            icon={<ZapIcon size={14} style={{ color: "#38bdf8", fill: "#38bdf8" }} />}
            iconBgColor="rgba(56, 189, 248, 0.12)"
            iconColor="#38bdf8"
            highlightColor="#38bdf8"
          />

          {/* Card 6: Mechanical */}
          <StatCard
            title="Mechanical"
            value={fmtCurrency(summary.mechanicalCost)}
            icon={<SettingsIcon size={14} style={{ color: "#f97316", fill: "#f97316" }} />}
            iconBgColor="rgba(249, 115, 22, 0.12)"
            iconColor="#f97316"
            highlightColor="#f97316"
          />
        </div>
      )}

      {/* Records Card */}
      {true && (
        <Card>
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg md:text-xl">
                Repair History for {selectedVehicle ? (
                  <span style={{ color: "#3b82f6", fontWeight: 700 }}>{selectedVehicle.vehicle_number}</span>
                ) : (
                  "All Vehicles"
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="w-full sm:w-72">
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
                    placeholder={
                      vehiclesLoading ? "Loading vehicles..." : "Search vehicle..."
                    }
                    emptyMessage="No vehicles found."
                    disabled={vehiclesLoading}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={openDrawer}
                  className="gap-2"
                >
                  <SlidersHorizontalIcon size={16} />
                  Filters
                  {activeFilterCount > 0 && (
                    <span style={styles.activeFilterBadge}>
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={isDownloading || recordsLoading}
                  className="gap-2"
                >
                  {isDownloading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <DownloadIcon size={16} />
                  )}
                  <span className="hidden sm:inline">Export</span>
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
                <CardListSkeleton count={5} lines={3} />
              ) : filteredRecords.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No records found.
                </p>
              ) : (
                filteredRecords.map((record) => (
                  <div
                    key={record.id}
                    className="border rounded-lg p-3 space-y-2 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => canManage && openEdit(record)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm">
                          {record.repair_date.split("T")[0]}
                        </span>
                        {!selectedVehicleId && record.vehicles?.vehicle_number && (
                          <span className="text-xs text-muted-foreground ml-2">
                            • {record.vehicles.vehicle_number}
                          </span>
                        )}
                      </div>
                      <Badge
                        variant={
                          record.status === "Closed" ? "success" : "warning"
                        }
                      >
                        {record.status}
                      </Badge>
                    </div>
                    <div style={styles.categoryMobileCellRow}>
                      <span style={styles.categoryCellIconBadgeSm(record.category)}>
                        {record.category === "electrical" ? (
                          <ZapIcon size={12} style={styles.electricalIconStyle} />
                        ) : (
                          <SettingsIcon size={12} style={styles.mechanicalIconStyle} />
                        )}
                      </span>
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
                    {canManage && (
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
                          <Trash2Icon size={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* ─── Desktop Table View ─── */}
            <div className="hidden md:block">
              <DataTable<RepairRecordWithVehicle>
                columns={[
                  {
                    key: "repair_date",
                    header: "Date",
                    cell: (row) => {
                      const [datePart, timePart] = row.repair_date.split("T");
                      const timeStr = timePart
                        ? new Date(row.repair_date).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "";
                      return (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ whiteSpace: "nowrap", fontWeight: 500 }}>
                            {datePart}
                          </span>
                          {timeStr && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--muted-foreground)",
                              }}
                            >
                              {timeStr}
                            </span>
                          )}
                        </div>
                      );
                    },
                  },
                  // Show Vehicle column only when viewing all vehicles
                  ...(!selectedVehicleId
                    ? [
                        {
                          key: "vehicle" as const,
                          header: "Vehicle",
                          cell: (row: RepairRecordWithVehicle) => (
                            <span className="font-medium text-foreground whitespace-nowrap">
                              {row.vehicles?.vehicle_number || "—"}
                            </span>
                          ),
                        },
                      ]
                    : []),
                  {
                    key: "category",
                    header: "Category",
                    cell: (row) => (
                      <div style={styles.categoryCellRow}>
                        <span style={styles.categoryCellIconBadge(row.category)}>
                          {row.category === "electrical" ? (
                            <ZapIcon
                              size={14}
                              style={styles.electricalIconStyle}
                            />
                          ) : (
                            <SettingsIcon
                              size={14}
                              style={styles.mechanicalIconStyle}
                            />
                          )}
                        </span>
                        <span style={styles.categoryCellLabel}>
                          {row.category}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "issues",
                    header: "Issues",
                    cell: (row) => (
                      <div className="flex flex-wrap gap-1">
                        {row.issues.map((issue) => (
                          <Badge key={issue} variant="secondary" className="text-xs">
                            {issue}
                          </Badge>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: "description",
                    header: "Description",
                    cell: (row) => row.description || "—",
                  },
                  {
                    key: "cost",
                    header: "Cost",
                    cell: (row) => `₹${Number(row.cost).toLocaleString()}`,
                  },
                  {
                    key: "technician",
                    header: "Technician",
                    cell: (row) => row.technicians?.name || "—",
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (row) => (
                      <Badge variant={row.status === "Closed" ? "success" : "warning"}>
                        {row.status}
                      </Badge>
                    ),
                  },
                ]}
                data={filteredRecords}
                rowKey={(row) => row.id.toString()}
                loading={recordsLoading}
                rowClickable={canManage}
                onRowClick={(row) => canManage && openEdit(row)}
                showActions={canManage}
                rowActions={[
                  {
                    key: "edit",
                    label: "Edit",
                    icon: <PencilIcon size={14} />,
                    onClick: (row) => openEdit(row),
                    hidden: () => !canManage,
                  },
                  {
                    key: "delete",
                    label: "Delete",
                    icon: <Trash2Icon size={14} />,
                    variant: "danger",
                    onClick: (row) => setDeleteTarget(row),
                    hidden: () => !canManage,
                  },
                ]}
              />
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="mt-4">
                <Pagination
                  page={page}
                  totalCount={total}
                  pageSize={pageSize}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Filter Drawer ── */}
        <FilterDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onApply={applyDrawerFilters}
        >
          <div style={filterFieldGroup}>
            <Label style={filterFieldLabel}>Category</Label>
            <Select
              value={drawerFilters.category || "all"}
              onValueChange={(v) =>
                setDrawerFilters((p) => ({
                  ...p,
                  category: (v === "all" ? "" : v) as RepairCategory | "",
                }))
              }
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="electrical">Electrical</SelectItem>
                <SelectItem value="mechanical">Mechanical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div style={filterFieldGroup}>
            <Label style={filterFieldLabel}>Status</Label>
            <Select
              value={drawerFilters.status || "all"}
              onValueChange={(v) =>
                setDrawerFilters((p) => ({
                  ...p,
                  status: (v === "all" ? "" : v) as RepairStatus | "",
                }))
              }
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

      {/* ─── Create / Edit Modal ─── */}
      {modalMode === "create" ? (
        <RepairModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchRecords}
          vehicles={vehicles}
          technicians={technicians}
          specializations={specializations}
          repairOptions={repairOptions}
          onIssueAdded={handleIssueAdded}
          onTechnicianAdded={handleTechnicianAdded}
          onSpecializationAdded={handleSpecializationAdded}
          mode="create"
          defaultVehicleId={selectedVehicleId}
        />
      ) : (
        editRecord && (
          <RepairModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            onSuccess={fetchRecords}
            vehicles={vehicles}
            technicians={technicians}
            specializations={specializations}
            repairOptions={repairOptions}
            onIssueAdded={handleIssueAdded}
            onTechnicianAdded={handleTechnicianAdded}
            onSpecializationAdded={handleSpecializationAdded}
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
