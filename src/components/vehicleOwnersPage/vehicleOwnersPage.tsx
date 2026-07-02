"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { PlusIcon, SearchIcon, PencilIcon, Trash2Icon, XIcon } from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { AddVehicleOwnerModal } from "@/components/addVehicleOwnerModal";
import { VehicleOwner } from "@/app/admin/vehicles/vehicles.types";
import { getOwnerTypeLabel } from "@/app/admin/vehicles/vehicles.utils";
import { invalidateVehicleOwnersCache } from "@/hooks/useVehicleOwners";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ConfirmModal from "@/components/confirmModal/confirmModal";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { DataTable } from "@/components/ui/dataTable/dataTable";
import type { ColumnDef, RowAction } from "@/components/ui/dataTable/dataTable.types";

export function VehicleOwnersPage() {
  const { userRole, loading: authLoading } = useAuth();
  const isAdmin = userRole === "admin";
  const canWrite = isAdmin || userRole === "staff";

  const [owners, setOwners] = useState<VehicleOwner[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [ownerToEdit, setOwnerToEdit] = useState<VehicleOwner | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<VehicleOwner | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchOwners = useCallback(async (opts?: { overrideSearch?: string }) => {
    const search = opts?.overrideSearch ?? debouncedSearch;
    try {
      setFetching(true);
      setError(null);

      const params = new URLSearchParams();
      if (search) params.set("search", search);

      const res = await fetch(`/api/vehicle-owners?${params}`);
      if (!res.ok) throw new Error("Failed to fetch owners");

      const json = await res.json();
      setOwners(json.data ?? []);
      setDebouncedSearch(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setFetching(false);
      setInitialLoading(false);
    }
  }, [debouncedSearch]);

  // Debounce search
  useEffect(() => {
    if (searchQuery === debouncedSearch) return;

    debounceRef.current = setTimeout(() => {
      fetchOwners({ overrideSearch: searchQuery });
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!authLoading && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchOwners();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const handleSuccess = (saved: VehicleOwner) => {
    // The API returns the mutated row — update in place instead of refetching,
    // and drop the vehicle-form modals' cached copy of the lookup table.
    invalidateVehicleOwnersCache();
    setOwners((prev) => {
      const next = prev.some((o) => o.id === saved.id)
        ? prev.map((o) => (o.id === saved.id ? saved : o))
        : [...prev, saved];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleEdit = (owner: VehicleOwner) => {
    setOwnerToEdit(owner);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setOwnerToEdit(null);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/vehicle-owners?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete");
      } else {
        invalidateVehicleOwnersCache();
        setOwners((prev) => prev.filter((o) => o.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnDef<VehicleOwner>[] = [
    {
      key: "name",
      header: "Name",
      cell: (owner) => <span className="font-medium text-foreground">{owner.name}</span>,
    },
    {
      key: "owner_type",
      header: "Owner Type",
      cell: (owner) => (
        <Badge variant={owner.owner_type === "EXTERNAL" ? "outline" : "secondary"}>
          {getOwnerTypeLabel(owner.owner_type)}
        </Badge>
      ),
    },
  ];

  const rowActions: RowAction<VehicleOwner>[] = [
    {
      key: "edit",
      label: "Edit",
      icon: <PencilIcon size={14} />,
      hidden: () => !canWrite,
      onClick: handleEdit,
    },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2Icon size={14} />,
      variant: "danger",
      hidden: () => !isAdmin,
      onClick: (owner) => setDeleteTarget(owner),
    },
  ];

  if (authLoading || initialLoading) return <PageLoadingSkeleton variant="admin" />;

  if (error && owners.length === 0) {
    return <ErrorState title="Error" description={error} onRetry={fetchOwners} />;
  }

  return (
    <div className="container mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Vehicle Owners
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage the owners (own proprietorships or external parties) vehicles can be assigned to
          </p>
        </div>
        {canWrite && (
          <Button onClick={handleAddNew} className="w-full sm:w-auto">
            <PlusIcon size={16} style={{ marginRight: "0.5rem" }} /> Add Owner
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-4 sm:p-6 border-b border-border space-y-4">
          <div className="relative w-full max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Search by name..."
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
                  fetchOwners({ overrideSearch: "" });
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
          {fetching && owners.length === 0 ? (
            <LoadingSpinner size="md" centered label="Loading owners..." />
          ) : error ? (
            <ErrorState title="Couldn't load owners" description={error} onRetry={fetchOwners} />
          ) : !fetching && owners.length === 0 ? (
            <EmptyState
              title="No owners found"
              description={
                debouncedSearch
                  ? "Try adjusting your search query."
                  : "Get started by adding your first owner."
              }
              actionLabel={debouncedSearch ? "Clear Search" : "Add Owner"}
              onAction={
                debouncedSearch
                  ? () => {
                      setSearchQuery("");
                      fetchOwners({ overrideSearch: "" });
                    }
                  : handleAddNew
              }
              icon={SearchIcon}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <DataTable
                  columns={columns}
                  data={owners}
                  rowKey={(o) => String(o.id)}
                  loading={fetching}
                  rowActions={rowActions}
                />
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {fetching ? (
                  <LoadingSpinner size="md" centered label="Loading owners..." />
                ) : (
                  owners.map((owner) => (
                    <div key={owner.id} className="rounded-lg border bg-card p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-semibold text-foreground text-lg">
                          {owner.name}
                        </div>
                        <Badge variant={owner.owner_type === "EXTERNAL" ? "outline" : "secondary"}>
                          {getOwnerTypeLabel(owner.owner_type)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t pt-3">
                        {canWrite && (
                          <Button variant="outline" size="sm" onClick={() => handleEdit(owner)}>
                            Edit
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(owner)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <AddVehicleOwnerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        ownerToEdit={ownerToEdit}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Delete Owner"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
