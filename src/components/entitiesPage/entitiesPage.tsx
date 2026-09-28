"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  SearchIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { canEdit as canEditRole, isAdmin as isAdminRole } from "@/lib/routePermissions";
import { invalidateVehicleOwnersCache } from "@/hooks/useVehicleOwners";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/pageHeader";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { DataTable } from "@/components/ui/dataTable/dataTable";
import type { ColumnDef, RowAction } from "@/components/ui/dataTable/dataTable.types";
import {
  getEntityKindLabel,
  getRelationshipLabel,
  type Entity,
} from "./entitiesPage.types";

// Lazy-loaded: only needed once a user opens one of these, so they shouldn't
// bloat the initial page chunk that has to load before anything can paint.
const EntityModal = dynamic(
  () => import("@/components/entityModal").then((m) => m.EntityModal),
  { ssr: false },
);
const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "FIRM", label: "Firms" },
  { key: "PERSON", label: "People" },
  { key: "EXTERNAL", label: "External" },
];

export function EntitiesPage() {
  const { userRole, loading: authLoading } = useAuth();
  const canEdit = canEditRole(userRole);
  // Edit/delete are admin-tier only (staff can add but not modify existing records).
  const canManage = isAdminRole(userRole);

  const [entities, setEntities] = useState<Entity[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [entityToEdit, setEntityToEdit] = useState<Entity | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Entity | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchEntities = useCallback(
    async (opts?: { overrideSearch?: string; overrideTab?: string }) => {
      const search = opts?.overrideSearch ?? debouncedSearch;
      const tab = opts?.overrideTab ?? activeTab;

      try {
        setFetching(true);
        setError(null);

        const params = new URLSearchParams({ with_counts: "true" });
        if (search) params.set("search", search);
        // "External" cuts across both kinds, so it filters on relationship
        // rather than entity_kind.
        if (tab === "FIRM" || tab === "PERSON") params.set("entity_kind", tab);
        if (tab === "EXTERNAL") params.set("relationship", "EXTERNAL");

        const res = await fetch(`/api/entities?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");

        const json = await res.json();
        setEntities(json.data?.data ?? []);
        setDebouncedSearch(search);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        setFetching(false);
      }
    },
    [debouncedSearch, activeTab],
  );

  // Debounce search
  useEffect(() => {
    if (searchQuery === debouncedSearch) return;

    debounceRef.current = setTimeout(() => {
      fetchEntities({ overrideSearch: searchQuery });
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
      fetchEntities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    fetchEntities({ overrideTab: tab });
  };

  const handleSuccess = () => {
    // A rename cascades onto vehicles server-side, and the proprietor column
    // may now resolve differently — refetch rather than patch in place, and
    // drop the vehicle forms' cached copy of the owner list.
    invalidateVehicleOwnersCache();
    fetchEntities();
  };

  const handleEdit = (entity: Entity) => {
    setEntityToEdit(entity);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEntityToEdit(null);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/entities?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete");
      } else {
        invalidateVehicleOwnersCache();
        setEntities((prev) => prev.filter((e) => e.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnDef<Entity>[] = [
    {
      key: "name",
      header: "Name",
      cell: (entity) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{entity.name}</span>
          {entity.proprietor_name && (
            <span className="text-xs text-muted-foreground">
              Proprietor: {entity.proprietor_name}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "entity_kind",
      header: "Type",
      mobile: "trailing",
      cell: (entity) => (
        <Badge variant="secondary">{getEntityKindLabel(entity.entity_kind)}</Badge>
      ),
    },
    {
      key: "relationship",
      header: "Relationship",
      cell: (entity) => (
        <Badge variant={entity.relationship === "EXTERNAL" ? "outline" : "secondary"}>
          {getRelationshipLabel(entity.relationship)}
        </Badge>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      cell: (entity) => entity.phone ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: "vehicle_count",
      header: "Vehicles",
      align: "right",
      cell: (entity) =>
        entity.vehicle_count ? (
          <span className="font-medium">{entity.vehicle_count}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const rowActions: RowAction<Entity>[] = [
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
      onClick: (entity) => setDeleteTarget(entity),
    },
  ];

  if (authLoading) return <PageLoadingSkeleton variant="admin" />;

  if (error && entities.length === 0) {
    return <ErrorState title="Error" description={error} onRetry={() => fetchEntities()} />;
  }

  const clearSearch = () => {
    setSearchQuery("");
    fetchEntities({ overrideSearch: "" });
  };

  return (
    <div className="container mx-auto animate-in space-y-6 fade-in duration-200 md:space-y-8">
      <PageHeader
        title="Firms & Owners"
        description="Our proprietorships and the people behind them, plus external parties whose vehicles we run. Loans are recorded against these names."
        primaryAction={
          canEdit
            ? { label: "Add Entity", testId: "entities-add-btn", onClick: handleAddNew }
            : undefined
        }
      />

      <div className="ss-panel overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="space-y-4 border-b border-border p-4 sm:p-6">
          <Tabs
            idPrefix="entities"
            items={FILTER_TABS}
            value={activeTab}
            onValueChange={handleTabChange}
          />

          <div className="relative w-full max-w-sm">
            <SearchIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              data-testid="entities-search-input"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 h-auto -translate-y-1/2 p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
                aria-label="Clear search"
              >
                <XIcon size={16} />
              </Button>
            )}
          </div>
        </div>

        <div
          className="p-4 pb-2 sm:p-6 sm:pb-4"
          role="tabpanel"
          id={`entities-panel-${activeTab}`}
          aria-labelledby={`entities-tab-${activeTab}`}
        >
          {error ? (
            <ErrorState
              title="Couldn't load"
              description={error}
              onRetry={() => fetchEntities()}
            />
          ) : !fetching && entities.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              description={
                debouncedSearch
                  ? "Try adjusting your search query."
                  : "Add your firms and the people behind them to get started."
              }
              actionLabel={debouncedSearch ? "Clear Search" : "Add Entity"}
              onAction={debouncedSearch ? clearSearch : handleAddNew}
              icon={SearchIcon}
            />
          ) : (
            <>
              {/* Table — DataTable renders it as cards below md */}
              <DataTable
                columns={columns}
                data={entities}
                rowKey={(e) => String(e.id)}
                loading={fetching}
                showActions={canManage}
                rowActions={rowActions}
              />
            

              {/* Mobile Cards */}
            </>
          )}
        </div>
      </div>

      <EntityModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        entityToEdit={entityToEdit}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Delete Entity"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
