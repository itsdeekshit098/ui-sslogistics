"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  PlusIcon,
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
import type { Technician, SpecializationOption } from "./techniciansPage.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { Pagination } from "@/components/pagination";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { DataTable } from "@/components/ui/dataTable/dataTable";
import type { ColumnDef, RowAction } from "@/components/ui/dataTable/dataTable.types";

// Lazy-loaded: only needed once a user opens one of these modals, so they
// shouldn't bloat the initial page chunk that has to load before anything
// (including the skeleton) can paint.
const AddTechnicianModal = dynamic(
  () => import("@/components/addTechnicianModal").then((m) => m.AddTechnicianModal),
  { ssr: false },
);
const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);

const DEFAULT_PAGE_SIZE = 10;

export function TechniciansPage() {
  const { userRole, loading: authLoading } = useAuth();
  const canEdit = canEditRole(userRole);
  // Edit/delete/status-toggle are admin-tier only (staff can add but not modify existing records).
  const canManage = isAdminRole(userRole);

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [specializations, setSpecializations] = useState<
    SpecializationOption[]
  >([]);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [technicianToEdit, setTechnicianToEdit] = useState<Technician | null>(
    null,
  );

  const [deleteTarget, setDeleteTarget] = useState<Technician | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchQuery === debouncedSearch) return;

    debounceRef.current = setTimeout(() => {
      fetchTechnicians({ overrideSearch: searchQuery, overridePage: 1 });
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Fetch specializations once
  const fetchSpecializations = useCallback(async () => {
    try {
      const res = await fetch("/api/specializations");
      if (res.ok) {
        const json = await res.json();
        setSpecializations(json.data ?? []);
      }
    } catch {
      // non-critical
    }
  }, []);

  // Fetch technicians
  const fetchTechnicians = useCallback(
    async (opts?: { overrideSearch?: string; overridePage?: number; overridePageSize?: number }) => {
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

        const res = await fetch(`/api/technicians?${params}`);
        if (!res.ok) throw new Error("Failed to fetch technicians");

        const json = await res.json();
        const result = json.data ?? {};
        setTechnicians(result.data ?? []);
        setTotal(result.total ?? 0);

        setPage(p);
        setPageSize(ps);
        setDebouncedSearch(search);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        setFetching(false);
        setInitialLoading(false);
      }
    },
    [page, pageSize, debouncedSearch],
  );

  // Page change handler
  const handlePageChange = (p: number) => {
    setPage(p);
    fetchTechnicians({ overridePage: p });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
    fetchTechnicians({ overridePage: 1, overridePageSize: size });
  };

  useEffect(() => {
    if (!authLoading) {
      fetchSpecializations();
    }
  }, [authLoading, fetchSpecializations]);

  // Initial fetch
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!authLoading && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchTechnicians();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const handleSuccess = () => {
    fetchTechnicians();
    fetchSpecializations();
  };

  const handleSpecializationAdded = useCallback(
    (spec: SpecializationOption) => {
      setSpecializations((prev) => {
        if (prev.find((s) => s.id === spec.id)) return prev;
        return [...prev, spec];
      });
    },
    [],
  );

  const handleEdit = (tech: Technician) => {
    setTechnicianToEdit(tech);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setTechnicianToEdit(null);
    setShowModal(true);
  };

  const toggleStatus = async (tech: Technician) => {
    try {
      const res = await fetch("/api/technicians", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tech.id,
          is_active: !tech.is_active,
        }),
      });
      if (res.ok) {
        fetchTechnicians();
      }
    } catch {
      // silent fail
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/technicians?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete");
      } else {
        fetchTechnicians();
        setDeleteTarget(null);
      }
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleteLoading(false);
    }
  };

  // DataTable column definitions
  const columns: ColumnDef<Technician>[] = [
    {
      key: "name",
      header: "Name",
      cell: (tech) => <span className="font-medium text-foreground">{tech.name}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      cell: (tech) => <span className="text-muted-foreground">{tech.phone || "—"}</span>,
    },
    {
      key: "location",
      header: "Location",
      cell: (tech) => <span className="text-muted-foreground">{tech.location || "—"}</span>,
    },
    {
      key: "specializations",
      header: "Specializations",
      cell: (tech) => (
        <div className="flex flex-wrap gap-1">
          {tech.specializations.map((spec) => (
            <span
              key={spec}
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold bg-background text-foreground"
            >
              {spec}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      cell: (tech) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
            tech.is_active
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
              : "bg-zinc-50 text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-400 dark:ring-zinc-500/20"
          }`}
        >
          {tech.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  // DataTable actions
  const rowActions: RowAction<Technician>[] = [
    {
      key: "status",
      label: "Toggle Status",
      icon: null, // Computed inside cell or we render dynamic icon
      hidden: () => !canManage,
      onClick: toggleStatus,
    },
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
      onClick: (tech) => setDeleteTarget(tech),
    },
  ];

  // Custom row actions with dynamic icon/label logic
  const formattedRowActions = rowActions.map((action) => {
    if (action.key === "status") {
      return {
        ...action,
        label: (tech: Technician) => (tech.is_active ? "Deactivate" : "Activate"),
        icon: (tech: Technician) =>
          tech.is_active ? (
            <XCircleIcon size={14} className="text-muted-foreground hover:text-amber-600" />
          ) : (
            <CheckCircleIcon size={14} className="text-muted-foreground hover:text-emerald-600" />
          ),
      };
    }
    return action;
  }) as RowAction<Technician>[];

  // Initial full-page skeleton
  if (authLoading || initialLoading)
    return <PageLoadingSkeleton variant="admin" />;

  // Fatal error with no data
  if (error && technicians.length === 0) {
    return (
      <ErrorState
        title="Error"
        description={error}
        onRetry={fetchTechnicians}
      />
    );
  }

  return (
    <div className="container mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Technicians
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your workshop technicians and their specializations
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleAddNew} className="w-full sm:w-auto">
            <PlusIcon size={16} style={{ marginRight: "0.5rem" }} /> Add Technician
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-4 sm:p-6 border-b border-border space-y-4">
          <div className="relative w-full max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Search by name, phone or location..."
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
                  fetchTechnicians({ overrideSearch: "", overridePage: 1 });
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
          {fetching && technicians.length === 0 ? (
            <LoadingSpinner size="md" centered label="Loading technicians..." />
          ) : error ? (
            <ErrorState
              title="Couldn't load technicians"
              description={error}
              onRetry={fetchTechnicians}
            />
          ) : !fetching && technicians.length === 0 ? (
            <EmptyState
              title="No technicians found"
              description={
                debouncedSearch
                  ? "Try adjusting your search query."
                  : "Get started by adding your first technician."
              }
              actionLabel={debouncedSearch ? "Clear Search" : "Add Technician"}
              onAction={
                debouncedSearch
                  ? () => {
                      setSearchQuery("");
                      fetchTechnicians({ overrideSearch: "", overridePage: 1 });
                    }
                  : handleAddNew
              }
              icon={SearchIcon}
            />
          ) : (
            <>
              {/* Desktop Table - standard UI component is DataTable */}
              <div className="hidden md:block">
                <DataTable
                  columns={columns}
                  data={technicians}
                  rowKey={(t) => String(t.id)}
                  loading={fetching}
                  showActions={canManage}
                  rowActions={formattedRowActions}
                  rowClassName={(tech) => (!tech.is_active ? "opacity-60 bg-muted/10" : "")}
                />
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {fetching ? (
                  <LoadingSpinner size="md" centered label="Loading technicians..." />
                ) : (
                  technicians.map((tech) => (
                    <div
                      key={tech.id}
                      className={`rounded-lg border bg-card p-4 shadow-sm ${
                        !tech.is_active ? "opacity-75 bg-muted/10" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-foreground text-lg">
                            {tech.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {tech.phone || "No phone"}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            tech.is_active
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-zinc-50 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400"
                          }`}
                        >
                          {tech.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="text-sm text-muted-foreground mb-3">
                        {tech.location || "No location"}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {tech.specializations.map((spec) => (
                          <span
                            key={spec}
                            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-background"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t pt-3">
                        {canManage && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleStatus(tech)}
                            >
                              {tech.is_active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(tech)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(tech)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

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
        </div>
      </div>

      <AddTechnicianModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        specializations={specializations}
        onSpecializationAdded={handleSpecializationAdded}
        technicianToEdit={technicianToEdit}
        mode="standalone"
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Delete Technician"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
