"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  SearchIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  Trash2Icon,
  XIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { canEdit as canEditRole, isAdmin as isAdminRole } from "@/lib/routePermissions";
import dynamic from "next/dynamic";
import type { Driver } from "./driversPage.types";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/pageHeader";
import { Button } from "@/components/ui/button";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { Pagination } from "@/components/pagination";
import { DataTable } from "@/components/ui/dataTable";

// Lazy-loaded: only needed once a user opens one of these modals, so they
// shouldn't bloat the initial page chunk that has to load before anything
// (including the skeleton) can paint.
const AddDriverModal = dynamic(
  () => import("@/components/addDriverModal").then((m) => m.AddDriverModal),
  { ssr: false },
);
const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);

const DEFAULT_PAGE_SIZE = 10;

export function DriversPage() {
  const { userRole, loading: authLoading } = useAuth();
  const canEdit = canEditRole(userRole);
  // Edit/delete/status-toggle are admin-tier only (staff can add but not modify existing records).
  const canManage = isAdminRole(userRole);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [driverToEdit, setDriverToEdit] = useState<Driver | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    // Skip if search hasn't actually changed from what was fetched
    if (searchQuery === debouncedSearch) return;

    debounceRef.current = setTimeout(() => {
      fetchData({ overrideSearch: searchQuery, overridePage: 1 });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const fetchData = useCallback(
    async (opts?: {
      overrideSearch?: string;
      overridePage?: number;
      overridePageSize?: number;
    }) => {
      const search = opts?.overrideSearch ?? debouncedSearch;
      const p = opts?.overridePage ?? page;
      const ps = opts?.overridePageSize ?? pageSize;

      try {
        setFetching(true);
        setError(null);

        const params = new URLSearchParams({
          include_inactive: "true",
          page: String(p),
          pageSize: String(ps),
        });
        if (search) params.set("search", search);

        const res = await fetch(`/api/drivers?${params}`);
        if (!res.ok) throw new Error("Failed to fetch drivers");

        const json = await res.json();
        const result = json.data ?? {};
        setDrivers(result.data ?? []);
        setTotal(result.total ?? 0);

        // Sync state on success
        setPage(p);
        setPageSize(ps);
        setDebouncedSearch(search);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        setFetching(false);
      }
    },
    [page, pageSize, debouncedSearch],
  );

  // Page change handlers — set state immediately for visual feedback
  const handlePageChange = (p: number) => {
    setPage(p);
    fetchData({ overridePage: p });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
    fetchData({ overridePage: 1, overridePageSize: size });
  };

  // Initial fetch
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!authLoading && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const handleSuccess = () => {
    fetchData();
  };

  const handleEdit = (driver: Driver) => {
    setDriverToEdit(driver);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setDriverToEdit(null);
    setShowModal(true);
  };

  const toggleStatus = async (driver: Driver) => {
    try {
      const res = await fetch("/api/drivers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: driver.id,
          is_active: !driver.is_active,
        }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch {
      // toggle failed silently
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/drivers?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete");
      } else {
        fetchData();
        setDeleteTarget(null);
      }
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (authLoading) return <PageLoadingSkeleton variant="admin" />;
  if (error && drivers.length === 0)
    return <ErrorState title="Error" description={error} onRetry={fetchData} />;

  return (
    <div className="container mx-auto space-y-6 md:space-y-8">
      <PageHeader
        title="Drivers"
        description="Manage your fleet drivers and their details"
        primaryAction={
          canEdit
            ? { label: "Add Driver", testId: "drivers-add-btn", onClick: handleAddNew }
            : undefined
        }
      />

      <div className="ss-panel bg-card rounded-xl border shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-4 sm:p-6 border-b border-border space-y-4">
          <div className="relative w-full max-w-sm">
            <SearchIcon
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              data-testid="drivers-search-input"
              placeholder="Search by name, phone, place or DL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 bg-background"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  fetchData({ overrideSearch: "", overridePage: 1 });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0 h-auto text-muted-foreground hover:bg-transparent hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <XIcon size={16} />
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pb-2 sm:p-6 sm:pb-4">
          {error ? (
            <ErrorState
              title="Couldn't load drivers"
              description={error}
              onRetry={fetchData}
            />
          ) : !fetching && drivers.length === 0 ? (
            <EmptyState
              title="No drivers found"
              description={
                debouncedSearch
                  ? "Try adjusting your search query."
                  : "Get started by adding your first driver."
              }
              actionLabel={debouncedSearch ? "Clear Search" : "Add Driver"}
              onAction={
                debouncedSearch
                  ? () => {
                      setSearchQuery("");
                      fetchData({ overrideSearch: "", overridePage: 1 });
                    }
                  : handleAddNew
              }
              icon={SearchIcon}
            />
          ) : (
            <>
              {/* Table — DataTable renders it as cards below md */}
              <DataTable<Driver>
                columns={[
                  {
                    key: "name",
                    header: "Name",
                    cell: (row) => (
                      <span className="font-medium text-foreground">
                        {row.name}
                      </span>
                    ),
                  },
                  {
                    key: "phone",
                    header: "Phone",
                    cell: (row) => row.phone || "—",
                  },
                  {
                    key: "place",
                    header: "Place",
                    cell: (row) => row.place || "—",
                  },
                  {
                    key: "dl_number",
                    header: "DL Number",
                    cell: (row) => row.dl_number || "—",
                  },
                  {
                    key: "status",
                    header: "Status",
                    mobile: "trailing",
                    cell: (row) => (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          row.is_active
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                            : "bg-zinc-50 text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-400 dark:ring-zinc-500/20"
                        }`}
                      >
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    ),
                  },
                ]}
                data={drivers}
                rowKey={(row) => row.id.toString()}
                loading={fetching}
                emptyNode={
                  <EmptyState
                    title="No drivers found"
                    description={
                      debouncedSearch
                        ? "Try adjusting your search query."
                        : "Get started by adding your first driver."
                    }
                    actionLabel={
                      debouncedSearch ? "Clear Search" : "Add Driver"
                    }
                    onAction={
                      debouncedSearch
                        ? () => {
                            setSearchQuery("");
                            fetchData({
                              overrideSearch: "",
                              overridePage: 1,
                            });
                          }
                        : handleAddNew
                    }
                    icon={SearchIcon}
                  />
                }
                showActions={canManage}
                rowActions={[
                  {
                    key: "toggle",
                    label: (row) =>
                      row.is_active ? "Deactivate" : "Activate",
                    icon: (row) =>
                      row.is_active ? (
                        <XCircleIcon size={14} className="text-amber-600" />
                      ) : (
                        <CheckCircleIcon
                          size={14}
                          className="text-emerald-600"
                        />
                      ),
                    onClick: (row) => toggleStatus(row),
                    hidden: () => !canManage,
                    testId: (row) => `drivers-toggle-status-btn-${row.id}`,
                  },
                  {
                    key: "edit",
                    label: "Edit",
                    icon: <PencilIcon size={14} />,
                    onClick: (row) => handleEdit(row),
                    hidden: () => !canManage,
                    testId: (row) => `drivers-edit-btn-${row.id}`,
                  },
                  {
                    key: "delete",
                    label: "Delete",
                    icon: <Trash2Icon size={14} />,
                    variant: "danger",
                    onClick: (row) => setDeleteTarget(row),
                    hidden: () => !canManage,
                    testId: (row) => `drivers-delete-btn-${row.id}`,
                  },
                ]}
              />
            

              {/* Mobile Cards */}
            </>
          )}

          {total > 0 && (
            <div className="mt-4">
              <Pagination
                page={page}
                totalCount={total}
                pageSize={pageSize}
                loading={fetching}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </div>
      </div>

      <AddDriverModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        driverToEdit={driverToEdit}
        mode="standalone"
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Delete Driver"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
