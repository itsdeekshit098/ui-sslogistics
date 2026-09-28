"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SearchIcon,
  PackageIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "@/components/ui/icon";
import { Pagination } from "@/components/pagination";
import { DataTable } from "@/components/ui/dataTable";
import type { ColumnDef } from "@/components/ui/dataTable";
import {
  FilterDrawer,
  fieldGroup as filterFieldGroup,
  fieldLabel as filterFieldLabel,
} from "@/components/ui/filterDrawer";
import { Tooltip } from "@/components/ui/tooltip";
import { PageFab } from "@/components/ui/pageFab";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import type { WarrantyItem, WarrantyStatusFilter } from "./warrantyPage.types";
import type { VehicleOption, Vendor } from "@/components/partModal";
import * as styles from "./warrantyPage.style";

// Lazy-loaded: only needed once a user opens one of these modals, so they
// shouldn't bloat the initial page chunk that has to load before anything
// (including the skeleton) can paint.
const PartModal = dynamic(
  () => import("@/components/partModal").then((m) => m.PartModal),
  { ssr: false },
);
const ConfirmModal = dynamic(
  () => import("@/components/confirmModal").then((m) => m.ConfirmModal),
  { ssr: false },
);

const STATUS_OPTIONS: { value: WarrantyStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "expiring_soon", label: "Expiring Soon" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
];

function StatusBadge({ status }: { status: WarrantyItem["warranty_status"] }) {
  const badgeStyle =
    status === "active"
      ? styles.statusActive
      : status === "expiring_soon"
        ? styles.statusExpiringSoon
        : styles.statusExpired;

  const label = status === "expiring_soon" ? "Expiring Soon" : status;

  return <span style={{ ...styles.statusBadge, ...badgeStyle }}>{label}</span>;
}

const columns: ColumnDef<WarrantyItem>[] = [
  {
    key: "part_name",
    header: "Part Name",
    sortable: true,
    cell: (row) => row.part_name,
  },
  {
    key: "vehicle",
    header: "Vehicle",
    mobile: "subtitle",
    cell: (row) => {
      if (!row.vehicles) return "—";
      // company/model are optional — skip the missing ones rather than
      // printing "GSHAHA — null null".
      const makeModel = [row.vehicles.company, row.vehicles.model].filter(Boolean).join(" ");
      return makeModel
        ? `${row.vehicles.vehicle_number} — ${makeModel}`
        : row.vehicles.vehicle_number;
    },
  },
  {
    key: "vendor",
    header: "Vendor",
    cell: (row) => row.vendors?.name ?? "—",
  },
  {
    key: "cost",
    header: "Cost (₹)",
    align: "right" as const,
    cell: (row) => `₹${row.cost.toLocaleString()}`,
  },
  {
    key: "purchase_date",
    header: "Purchase Date",
    sortable: true,
    cell: (row) => row.purchase_date,
  },
  {
    key: "warranty_expiry",
    header: "Expiry Date",
    sortable: true,
    cell: (row) => row.warranty_expiry,
  },
  {
    key: "warranty_duration",
    header: "Warranty",
    cell: (row) => `${row.warranty_duration} ${row.warranty_duration_unit}`,
  },
  {
    key: "notes",
    header: "Notes",
    cell: (row) =>
      row.notes ? (
        <Tooltip content={row.notes}>
          <span style={styles.notesCell}>{row.notes}</span>
        </Tooltip>
      ) : (
        "—"
      ),
  },
  {
    key: "warranty_status",
    header: "Status",
    mobile: "trailing",
    cell: (row) => <StatusBadge status={row.warranty_status} />,
  },
];

export function WarrantyPage() {
  const [items, setItems] = useState<WarrantyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Reference data state
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [partOptions, setPartOptions] = useState<
    { id: number; name: string }[]
  >([]);
  const [refDataLoading, setRefDataLoading] = useState(true);
  const [refDataError, setRefDataError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statusFilter, setStatusFilter] = useState<WarrantyStatusFilter>("all");
  const [showAddPart, setShowAddPart] = useState(false);

  const [editItem, setEditItem] = useState<WarrantyItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<WarrantyItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);


  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFilters, setDrawerFilters] = useState<{
    status: WarrantyStatusFilter;
  }>({ status: "all" });

  const [pageSize, setPageSize] = useState(20);

  // Fetch reference data once on mount
  useEffect(() => {
    const fetchRefData = async () => {
      try {
        const [vehRes, venRes, partRes] = await Promise.all([
          fetch(
            "/api/vehicles?pageSize=200&fields=id,vehicle_number,company,model",
          )
            .then((r) => r.json())
            .catch(() => null),
          fetch("/api/vendors?pageSize=100")
            .then((r) => r.json())
            .catch(() => null),
          fetch("/api/part-options?limit=100")
            .then((r) => r.json())
            .catch(() => null),
        ]);
        
        const hadError = !vehRes?.success || !venRes?.success || !partRes?.success;
        
        if (vehRes?.success) setVehicles(vehRes.data.data ?? vehRes.data ?? []);
        if (venRes?.success) setVendors(venRes.data.data ?? []);
        if (partRes?.success) setPartOptions(partRes.data.data ?? []);
        
        if (hadError) {
          setRefDataError(
            "Failed to load form reference data. Some features may be unavailable.",
          );
        }
      } catch {
        setRefDataError(
          "Failed to load form reference data. Some features may be unavailable.",
        );
      } finally {
        setRefDataLoading(false);
      }
    };
    fetchRefData();
  }, []);

  // Debounce search
  useEffect(() => {
    if (search === debouncedSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, debouncedSearch]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/warranty?${params}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data.data);
        setTotal(json.data.total);
      } else {
        const errorMsg = json.error || "Failed to load warranty records.";
        setFetchError(
          errorMsg.toLowerCase().includes("internal server")
            ? "Failed to load warranty records. Please try again."
            : errorMsg
        );
      }
    } catch {
      setFetchError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Drawer handlers ───
  const openDrawer = () => {
    setDrawerFilters({ status: statusFilter });
    setDrawerOpen(true);
  };

  const applyDrawerFilters = () => {
    setStatusFilter(drawerFilters.status);
    setPage(1);
    setDrawerOpen(false);
  };

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
    setDrawerFilters({ status: "all" });
    setDrawerOpen(false);
  };

  const activeFilterCount = [statusFilter !== "all" ? statusFilter : ""].filter(
    Boolean,
  ).length;

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/warranty?id=${deleteItem.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteItem(null);
        if (items.length === 1 && page > 1) {
          setPage(page - 1);
        } else {
          fetchData();
        }
      } else {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete part");
      }
    } catch {
      setDeleteError("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const addPartBtn = (
    <Button
      data-testid="warranty-add-btn"
      onClick={() => setShowAddPart(true)}
      disabled={refDataLoading || !!refDataError}
      style={refDataError ? { pointerEvents: "none" } : undefined}
    >
      <PlusIcon size={16} style={{ marginRight: "0.375rem" }} />
      Add Part
    </Button>
  );

  return (
    <div style={styles.pageContainer} className="md:p-6">
      {/* Header */}
      <div style={styles.headerRow} className="max-md:!hidden">
        <h1 style={styles.title} className="max-md:hidden">
          <PackageIcon
            size={24}
            style={{ marginRight: "0.5rem", verticalAlign: "middle" }}
          />
          Warranty Tracking
        </h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Button variant="outline" onClick={openDrawer}>
            <SlidersHorizontalIcon
              size={16}
              style={{ marginRight: "0.375rem" }}
            />
            Filters
            {activeFilterCount > 0 && (
              <span style={styles.activeFilterBadge}>{activeFilterCount}</span>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Clear all
            </Button>
          )}
          <span className="max-md:hidden">
            {refDataError ? (
              <Tooltip content={refDataError}>
                <span style={{ cursor: "not-allowed", display: "inline-block" }}>
                  {addPartBtn}
                </span>
              </Tooltip>
            ) : (
              addPartBtn
            )}
          </span>
        </div>
      </div>
      <PageFab
        label="Add Part"
        testId="warranty-add-btn-fab"
        onClick={() => setShowAddPart(true)}
        disabled={refDataLoading || !!refDataError}
        disabledReason={refDataError ?? undefined}
      />

      {/* Search bar */}
      <div style={styles.searchRow}>
        <div style={{ position: "relative", flex: 1, maxWidth: "320px" }} className="max-md:!max-w-none">
          <SearchIcon
            size={16}
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted-foreground, #64748b)",
            }}
          />
          <Input
            data-testid="warranty-search-input"
            placeholder="Search by part name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "2.25rem", width: "100%" }}
          />
        </div>
        {/* Phones: the header row (with its Filters button) is hidden, so
            filters sit beside the search like every other list page. */}
        <Button
          variant="outline"
          onClick={openDrawer}
          aria-label="Filters"
          className="h-11 shrink-0 gap-1.5 px-3 md:hidden"
        >
          <SlidersHorizontalIcon size={18} />
          {activeFilterCount > 0 && (
            <span style={styles.activeFilterBadge}>{activeFilterCount}</span>
          )}
        </Button>
      </div>

      {/* Content — Table on desktop, Cards on mobile */}
      {/* DataTable renders cards below md */}
        <div style={styles.tableContainer}>
          <DataTable
            columns={columns}
            data={items}
            rowKey={(r) => r.id}
            loading={loading}
            emptyMessage="No warranty records found"
            emptyNode={
              fetchError ? (
                <ErrorState title="Error" description={fetchError} onRetry={() => fetchData()} />
              ) : (
                <EmptyState
                  icon={PackageIcon}
                  title="No Warranty Records"
                  description="No warranty records found for the selected filters."
                  actionLabel="Add Warranty Part"
                  onAction={() => setShowAddPart(true)}
                />
              )
            }
            striped
            stickyHeader
            rowActions={[
              {
                key: "edit",
                label: "Edit",
                icon: <PencilIcon size={14} />,
                disabled: () => !!refDataError,
                disabledTooltip: refDataError || undefined,
                onClick: (row) => setEditItem(row),
                testId: (row) => `warranty-edit-btn-${row.id}`,
              },
              {
                key: "delete",
                label: "Delete",
                icon: <Trash2Icon size={14} />,
                variant: "danger",
                onClick: (row) => setDeleteItem(row),
                testId: (row) => `warranty-delete-btn-${row.id}`,
              },
            ]}
          />
        </div>

      {total > 0 && (
        <Pagination
          page={page}
          totalCount={total}
          pageSize={pageSize}
          loading={loading}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}

      {/* Filter Drawer */}
      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApply={applyDrawerFilters}
      >
        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>Status</Label>
          <Select
            value={drawerFilters.status}
            onValueChange={(v) =>
              setDrawerFilters({
                ...drawerFilters,
                status: v as WarrantyStatusFilter,
              })
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterDrawer>

      {/* Add Part Modal */}
      <PartModal
        isOpen={showAddPart}
        mode="add"
        onClose={() => setShowAddPart(false)}
        onSuccess={() => {
          fetchData();
        }}
        vehicles={vehicles}
        vendors={vendors}
        partOptions={partOptions}
        onVendorAdded={(v) => setVendors((prev) => [...prev, v])}
        onPartAdded={(p) => setPartOptions((prev) => [...prev, p])}
      />

      {/* Edit Part Modal */}
      {editItem && (
        <PartModal
          isOpen={true}
          mode="edit"
          initialData={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => {
            fetchData();
            setEditItem(null);
          }}
          vehicles={vehicles}
          vendors={vendors}
          partOptions={partOptions}
          onVendorAdded={(v) => setVendors((prev) => [...prev, v])}
          onPartAdded={(p) => setPartOptions((prev) => [...prev, p])}
        />
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteItem}
        title="Delete Part"
        description={`Are you sure you want to delete ${deleteItem?.part_name}? This action cannot be undone.`}
        confirmText={isDeleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        onConfirm={handleDelete}
        onClose={() => {
          setDeleteItem(null);
          setDeleteError(null);
        }}
        isLoading={isDeleting}
        error={deleteError}
      />
    </div>
  );
}
