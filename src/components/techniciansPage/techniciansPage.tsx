"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  Pencil,
  CheckCircle2,
  XCircle,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AddTechnicianModal } from "@/components/addTechnicianModal";
import type { Technician, SpecializationOption } from "./techniciansPage.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/confirmModal/confirmModal";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { Pagination } from "@/components/pagination";
import { LoadingSpinner } from "@/components/loadingSpinner";

const DEFAULT_PAGE_SIZE = 10;

export function TechniciansPage() {
  const { userRole, loading: authLoading } = useAuth();

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

  // Debounce search input
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
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
      // non-critical — specializations are only needed for the modal
    }
  }, []);

  // Fetch technicians (server-side paginated + search)
  const fetchTechnicians = useCallback(async () => {
    try {
      setFetching(true);
      setError(null);

      const params = new URLSearchParams({
        include_inactive: "true",
        page: String(page),
        pageSize: String(pageSize),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/technicians?${params}`);
      if (!res.ok) throw new Error("Failed to fetch technicians");

      const json = await res.json();
      const result = json.data ?? {};
      setTechnicians(result.data ?? []);
      setTotal(result.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setFetching(false);
      setInitialLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    if (!authLoading) {
      fetchSpecializations();
    }
  }, [authLoading, fetchSpecializations]);

  useEffect(() => {
    if (!authLoading) fetchTechnicians();
  }, [authLoading, fetchTechnicians]);

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
      // toggle failed silently
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

  // Initial full-page skeleton (only on first mount)
  if (authLoading || initialLoading)
    return <PageLoadingSkeleton variant="admin" />;

  // Fatal error with no data at all
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
    <div className="container mx-auto space-y-6 md:space-y-8">
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
        <Button onClick={handleAddNew} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Add Technician
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-4 sm:p-6 border-b border-border space-y-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pb-2 sm:p-6 sm:pb-4">
          {fetching ? (
            <LoadingSpinner size="md" centered label="Loading technicians..." />
          ) : error ? (
            <ErrorState
              title="Couldn't load technicians"
              description={error}
              onRetry={fetchTechnicians}
            />
          ) : technicians.length === 0 ? (
            <EmptyState
              title="No technicians found"
              description={
                debouncedSearch
                  ? "Try adjusting your search query."
                  : "Get started by adding your first technician."
              }
              actionLabel={debouncedSearch ? "Clear Search" : "Add Technician"}
              onAction={
                debouncedSearch ? () => setSearchQuery("") : handleAddNew
              }
              icon={Search}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block rounded-md border border-border overflow-x-auto overflow-y-hidden">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="h-12 px-4 text-left font-medium">Name</th>
                      <th className="h-12 px-4 text-left font-medium">Phone</th>
                      <th className="h-12 px-4 text-left font-medium">
                        Location
                      </th>
                      <th className="h-12 px-4 text-left font-medium">
                        Specializations
                      </th>
                      <th className="h-12 px-4 text-left font-medium">
                        Status
                      </th>
                      {userRole === "admin" && (
                        <th className="h-12 px-4 text-left font-medium">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {technicians.map((tech) => (
                      <tr
                        key={tech.id}
                        className={`transition-colors hover:bg-muted/30 ${
                          !tech.is_active ? "opacity-60 bg-muted/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          {tech.name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {tech.phone || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {tech.location || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {tech.specializations.map((spec) => (
                              <span
                                key={spec}
                                className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold bg-background"
                              >
                                {spec}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              tech.is_active
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                                : "bg-zinc-50 text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-400 dark:ring-zinc-500/20"
                            }`}
                          >
                            {tech.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        {userRole === "admin" && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => toggleStatus(tech)}
                                  title={tech.is_active ? "Deactivate" : "Activate"}
                                >
                                  {tech.is_active ? (
                                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-amber-600" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4 text-muted-foreground hover:text-emerald-600" />
                                  )}
                                  <span className="sr-only">Toggle Status</span>
                                </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleEdit(tech)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                </>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(tech)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {technicians.map((tech) => (
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
                      {userRole === "admin" && (
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
                        </>
                      )}
                      {userRole === "admin" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(tech)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {total > 0 && (
            <div className="mt-4">
              <Pagination
                page={page}
                totalCount={total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
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
