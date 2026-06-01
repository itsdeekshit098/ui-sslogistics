"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { PartModal } from "@/components/partModal";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ConfirmModal } from "@/components/confirmModal";
import type { WarrantyItem, WarrantyStatusFilter } from "./warrantyPage.types";
import type { VehicleOption, Vendor } from "@/components/partModal";
import * as styles from "./warrantyPage.style";

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

function WarrantyCard({
  item,
  onEdit,
  onDelete,
  refDataError,
}: {
  item: WarrantyItem;
  onEdit: (item: WarrantyItem) => void;
  onDelete: (item: WarrantyItem) => void;
  refDataError?: string | null;
}) {
  const editBtn = (
    <Button
      variant="outline"
      size="sm"
      disabled={!!refDataError}
      style={refDataError ? { pointerEvents: "none" } : undefined}
      onClick={() => onEdit(item)}
    >
      <PencilIcon size={14} style={{ marginRight: "0.25rem" }} /> Edit
    </Button>
  );

  return (
    <div style={styles.warrantyCard}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <span style={styles.cardPartName}>{item.part_name}</span>
        <StatusBadge status={item.warranty_status} />
      </div>
      {item.vehicles && (
        <span style={styles.cardVehicle}>
          {item.vehicles.vehicle_number} — {item.vehicles.company}{" "}
          {item.vehicles.model}
        </span>
      )}
      <span style={styles.cardDetail}>
        Vendor: {item.vendors?.name ?? "Unknown"}
      </span>
      <span style={styles.cardDetail}>
        Cost: ₹{item.cost.toLocaleString()} | Warranty: {item.warranty_duration}{" "}
        {item.warranty_duration_unit}
      </span>
      <span style={styles.cardDetail}>
        Purchased: {item.purchase_date} | Expires: {item.warranty_expiry}
      </span>
      {item.notes && (
        <Tooltip content={item.notes}>
          <span
            style={{
              ...styles.cardDetail,
              fontStyle: "italic",
              ...styles.notesCell,
            }}
          >
            {item.notes}
          </span>
        </Tooltip>
      )}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          justifyContent: "flex-end",
          marginTop: "0.5rem",
        }}
      >
        {refDataError ? (
          <Tooltip content={refDataError}>
            <span style={{ cursor: "not-allowed", display: "inline-block" }}>
              {editBtn}
            </span>
          </Tooltip>
        ) : (
          editBtn
        )}
        <Button variant="destructive" size="sm" onClick={() => onDelete(item)}>
          <Trash2Icon size={14} style={{ marginRight: "0.25rem" }} /> Delete
        </Button>
      </div>
    </div>
  );
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
    cell: (row) =>
      row.vehicles
        ? `${row.vehicles.vehicle_number} — ${row.vehicles.company} ${row.vehicles.model}`
        : "—",
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

  const isMobile = useIsMobile();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFilters, setDrawerFilters] = useState<{
    status: WarrantyStatusFilter;
  }>({ status: "all" });

  const pageSize = 20;

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
  }, [page, debouncedSearch, statusFilter]);

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
      onClick={() => setShowAddPart(true)}
      disabled={refDataLoading || !!refDataError}
      style={refDataError ? { pointerEvents: "none" } : undefined}
    >
      <PlusIcon size={16} style={{ marginRight: "0.375rem" }} />
      Add Part
    </Button>
  );

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <div style={styles.headerRow}>
        <h1 style={styles.title}>
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
          {refDataError ? (
            <Tooltip content={refDataError}>
              <span style={{ cursor: "not-allowed", display: "inline-block" }}>
                {addPartBtn}
              </span>
            </Tooltip>
          ) : (
            addPartBtn
          )}
        </div>
      </div>

      {/* Search bar */}
      <div style={styles.searchRow}>
        <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
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
            placeholder="Search by part name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "2.25rem", width: "100%" }}
          />
        </div>
      </div>

      {/* Content — Table on desktop, Cards on mobile */}
      {isMobile ? (
        <>
          {loading ? (
            <div style={styles.emptyContainer}>Loading warranty records...</div>
          ) : fetchError ? (
            <div style={{ ...styles.emptyContainer, flexDirection: "column", gap: "1rem" }}>
              <span style={{ color: "var(--destructive, #ef4444)" }}>{fetchError}</span>
              <Button variant="outline" size="sm" onClick={() => fetchData()}>
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div style={styles.emptyContainer}>
              <span>No warranty records found</span>
            </div>
          ) : (
            <div style={styles.cardGrid}>
              {items.map((item) => (
                <WarrantyCard
                  key={item.id}
                  item={item}
                  onEdit={setEditItem}
                  onDelete={setDeleteItem}
                  refDataError={refDataError}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={styles.tableContainer}>
          <DataTable
            columns={columns}
            data={items}
            rowKey={(r) => r.id}
            loading={loading}
            emptyMessage="No warranty records found"
            emptyNode={
              fetchError ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "2rem" }}>
                  <span style={{ color: "var(--destructive, #ef4444)" }}>{fetchError}</span>
                  <Button variant="outline" size="sm" onClick={() => fetchData()}>
                    Retry
                  </Button>
                </div>
              ) : undefined
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
              },
              {
                key: "delete",
                label: "Delete",
                icon: <Trash2Icon size={14} />,
                variant: "danger",
                onClick: (row) => setDeleteItem(row),
              },
            ]}
          />
        </div>
      )}

      {!loading && total > pageSize && (
        <Pagination
          page={page}
          totalCount={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={() => {}}
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
