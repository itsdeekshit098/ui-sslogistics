"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PlusIcon,
  SearchIcon,
  TruckIcon,
  CarIcon,
  BusIcon,
  VanIcon,
  FolderOpenIcon,
  Trash2Icon,
  PencilIcon,
  ArrowLeftIcon,
  XIcon,
  SlidersHorizontalIcon,
} from "@/components/ui/icon";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { canEdit as canEditRole, isAdmin as isAdminRole } from "@/lib/routePermissions";
import { Modal, ModalContent } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Vehicle,
  VehicleType,
  VEHICLE_TYPES,
  FUEL_TYPES,
  OWNER_TYPES,
} from "./vehicles.types";
import { useVehicleOwners } from "@/hooks/useVehicleOwners";
import {
  getStatusBadgeVariant,
  getVehicleTypeLabel,
  getVehicleSubDetail,
  getOwnerTypeLabel,
} from "./vehicles.utils";
import HighlightMatch from "./highlightMatch";
import * as styles from "./vehiclesPage.style";
import {
  CA_VEHICLES_CONTAINER,
  CA_VEHICLES_HEADER_TITLE,
  CA_VEHICLES_HEADER_DESC,
} from "./vehicles.styles";
import { DocumentModal } from "@/components/documentModal";
import { Skeleton } from "@/components/skeletonLoader";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { CreateVehicleModal } from "@/components/createVehicleModal";
import { EditVehicleModal } from "@/components/editVehicleModal";
import { ErrorState } from "@/components/errorState";
import { deleteVehicle } from "@/services/vehiclesService";
import { EmptyState } from "@/components/emptyState";
import { Pagination } from "@/components/pagination";
import { DataTable } from "@/components/ui/dataTable";
import { Badge } from "@/components/ui/badge";
import {
  FilterDrawer,
  fieldGroup as filterFieldGroup,
  fieldLabel as filterFieldLabel,
} from "@/components/ui/filterDrawer";

export default function VehiclesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { userRole, loading: authLoading } = useAuth();
  const canEdit = canEditRole(userRole);
  // Edit/delete are admin-tier only (staff can add but not modify existing records).
  const canManage = isAdminRole(userRole);

  // ─── Consolidated filter state ───
  const [pageSize, setPageSize] = useState(
    Math.max(10, Number(searchParams.get("pageSize")) || 10),
  );
  const [page, setPage] = useState(
    Math.max(1, Number(searchParams.get("page")) || 1),
  );
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    maintenance: 0,
    idle: 0,
  });
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || "",
  );
  const [debouncedQuery, setDebouncedQuery] = useState(
    searchParams.get("search") || "",
  );
  const [typeFilter, setTypeFilter] = useState<VehicleType | "all">(
    (searchParams.get("type") as VehicleType | "all") || "all",
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "",
  );
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<string>(
    searchParams.get("ownerType") || "",
  );
  const [ownerNameFilter, setOwnerNameFilter] = useState<string>(
    searchParams.get("ownerName") || "",
  );
  const [fuelTypeFilter, setFuelTypeFilter] = useState<string>(
    searchParams.get("fuelType") || "",
  );
  const [drawerFilters, setDrawerFilters] = useState<{
    type: VehicleType | "all";
    status: string;
    ownerType: string;
    ownerName: string;
    fuelType: string;
  }>({
    type: (searchParams.get("type") as VehicleType | "all") || "all",
    status: searchParams.get("status") || "",
    ownerType: searchParams.get("ownerType") || "",
    ownerName: searchParams.get("ownerName") || "",
    fuelType: searchParams.get("fuelType") || "",
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { owners } = useVehicleOwners();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters =
    searchQuery !== "" ||
    typeFilter !== "all" ||
    statusFilter !== "" ||
    ownerTypeFilter !== "" ||
    ownerNameFilter !== "" ||
    fuelTypeFilter !== "";

  // ─── URL sync ───
  const syncUrl = useCallback(
    (
      p: number,
      ps: number,
      search: string,
      type: VehicleType | "all",
      status: string,
      ownerType: string,
      ownerName: string,
      fuelType: string,
    ) => {
      const params = new URLSearchParams();
      if (p > 1) params.set("page", String(p));
      if (ps !== 10) params.set("pageSize", String(ps));
      if (search) params.set("search", search);
      if (type !== "all") params.set("type", type);
      if (status) params.set("status", status);
      if (ownerType) params.set("ownerType", ownerType);
      if (ownerName) params.set("ownerName", ownerName);
      if (fuelType) params.set("fuelType", fuelType);
      const qs = params.toString();
      router.replace(`/admin/vehicles${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [router],
  );

  // ─── Atomic fetch — accepts explicit params to avoid stale-state cascades ───
  // requestIdRef guards against out-of-order responses: if the user changes
  // page/filters again before an in-flight request resolves, the older
  // response is discarded instead of clobbering the newer one.
  const requestIdRef = useRef(0);
  const fetchVehicles = useCallback(
    async (opts?: {
      overridePage?: number;
      overridePageSize?: number;
      overrideSearch?: string;
      overrideType?: VehicleType | "all";
      overrideStatus?: string;
      overrideOwnerType?: string;
      overrideOwnerName?: string;
      overrideFuelType?: string;
    }) => {
      const p = opts?.overridePage ?? page;
      const ps = opts?.overridePageSize ?? pageSize;
      const search = opts?.overrideSearch ?? debouncedQuery;
      const type = opts?.overrideType ?? typeFilter;
      const st = opts?.overrideStatus ?? statusFilter;
      const ot = opts?.overrideOwnerType ?? ownerTypeFilter;
      const on = opts?.overrideOwnerName ?? ownerNameFilter;
      const ft = opts?.overrideFuelType ?? fuelTypeFilter;

      const requestId = ++requestIdRef.current;

      setLoading(true);
      setFetchError(null);
      // Optimistic URL sync
      syncUrl(p, ps, search, type, st, ot, on, ft);

      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(ps),
        });
        if (search) params.set("search", search);
        if (type !== "all") params.set("type", type);
        if (st) params.set("status", st);
        if (ot) params.set("ownerType", ot);
        if (on) params.set("ownerName", on);
        if (ft) params.set("fuelType", ft);

        const res = await fetch(`/api/vehicles?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");

        const json = await res.json();
        if (requestIdRef.current !== requestId) return; // superseded by a newer request

        const result = json.data ?? {};
        setVehicles(result.data ?? []);
        setTotal(result.total ?? 0);
        if (result.stats) setStats(result.stats);

        // Sync state on success
        setPage(p);
        setPageSize(ps);
        setDebouncedQuery(search);
        setTypeFilter(type);
        setStatusFilter(st);
        setOwnerTypeFilter(ot);
        setOwnerNameFilter(on);
        setFuelTypeFilter(ft);
      } catch {
        if (requestIdRef.current !== requestId) return;
        setFetchError(
          "We couldn\u2019t load your vehicles. Please check your connection and try again.",
        );
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    },
    [
      page,
      pageSize,
      debouncedQuery,
      typeFilter,
      statusFilter,
      ownerTypeFilter,
      ownerNameFilter,
      fuelTypeFilter,
      syncUrl,
    ],
  );

  // Initial fetch on mount
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchVehicles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search — fires a single atomic fetch with page=1
  useEffect(() => {
    // Skip if search hasn't actually changed from what was fetched
    if (searchQuery === debouncedQuery) return;

    debounceRef.current = setTimeout(() => {
      fetchVehicles({ overrideSearch: searchQuery, overridePage: 1 });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // ─── Filter/page change handlers (all atomic, no cascading effects) ───
  const openDrawer = () => {
    setDrawerFilters({
      type: typeFilter,
      status: statusFilter,
      ownerType: ownerTypeFilter,
      ownerName: ownerNameFilter,
      fuelType: fuelTypeFilter,
    });
    setIsDrawerOpen(true);
  };

  const applyDrawerFilters = () => {
    setTypeFilter(drawerFilters.type);
    setStatusFilter(drawerFilters.status);
    setOwnerTypeFilter(drawerFilters.ownerType);
    setOwnerNameFilter(drawerFilters.ownerName);
    setFuelTypeFilter(drawerFilters.fuelType);
    setPage(1);
    setIsDrawerOpen(false);
    fetchVehicles({
      overrideType: drawerFilters.type,
      overrideStatus: drawerFilters.status,
      overrideOwnerType: drawerFilters.ownerType,
      overrideOwnerName: drawerFilters.ownerName,
      overrideFuelType: drawerFilters.fuelType,
      overridePage: 1,
    });
  };

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setTypeFilter("all");
    setStatusFilter("");
    setOwnerTypeFilter("");
    setOwnerNameFilter("");
    setFuelTypeFilter("");
    setDrawerFilters({
      type: "all",
      status: "",
      ownerType: "",
      ownerName: "",
      fuelType: "",
    });
    setIsDrawerOpen(false);
    setPage(1);
    fetchVehicles({
      overrideSearch: "",
      overrideType: "all",
      overrideStatus: "",
      overrideOwnerType: "",
      overrideOwnerName: "",
      overrideFuelType: "",
      overridePage: 1,
    });
  }, [fetchVehicles]);

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchVehicles({ overridePage: p });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
    fetchVehicles({ overridePage: 1, overridePageSize: size });
  };

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Document Modal State
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [docVehicle, setDocVehicle] = useState<Vehicle | null>(null);

  // Delete Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchVehiclesRefetch = useCallback(() => {
    // Re-fetch current page (used after create/edit/delete)
    fetchVehicles();
  }, [fetchVehicles]);

  const handleEditClick = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsEditOpen(true);
  };

  // Tracks which vehicle the open delete dialog currently targets, independent
  // of React state timing — used to detect if the target changed while a
  // delete request was in flight (see handleDeleteVehicle).
  const activeDeleteIdRef = useRef<number | null>(null);

  const handleDeleteClick = (vehicle: Vehicle) => {
    setDeletingVehicle(vehicle);
    activeDeleteIdRef.current = vehicle.id;
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  const handleDeleteVehicle = async () => {
    if (!deletingVehicle) return;
    const targetId = deletingVehicle.id;

    setIsDeleting(true);
    setDeleteError(null);

    const result = await deleteVehicle(targetId);

    if (!result.success) {
      setDeleteError(result.error ?? "Unexpected error deleting vehicle.");
      setIsDeleting(false);
      return;
    }

    // Refetch to get fresh data from the server
    await fetchVehicles();

    setIsDeleting(false);
    // Only close/clear the dialog if it's still targeting the vehicle we just
    // deleted. The Cancel button and modal dismissal are disabled while
    // isDeleting, so this shouldn't normally trigger — it's a safety net
    // against a stale completion clobbering a dialog reopened for another
    // vehicle.
    if (activeDeleteIdRef.current === targetId) {
      setIsDeleteOpen(false);
      setDeletingVehicle(null);
    }
  };

  if (authLoading || initialLoading)
    return <PageLoadingSkeleton variant="admin" />;
  if (fetchError && vehicles.length === 0)
    return (
      <ErrorState
        title="Error"
        description={fetchError}
        onRetry={() => fetchVehicles()}
      />
    );

  return (
    <div className={CA_VEHICLES_CONTAINER}>
      <Button
        data-testid="vehicles-back-btn"
        variant="ghost"
        onClick={() => router.back()}
        className="mb-2 w-fit -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon size={16} style={{ marginRight: "0.5rem" }} />
        Back
      </Button>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={CA_VEHICLES_HEADER_TITLE}>Vehicles</h1>
          <p className={CA_VEHICLES_HEADER_DESC}>
            Manage your fleet of buses, cars, and trucks.
          </p>
        </div>
        {canEdit && (
          <Button
            data-testid="vehicles-add-btn"
            className="w-full md:w-auto"
            onClick={() => setIsCreateOpen(true)}
          >
            <PlusIcon size={16} style={{ marginRight: "0.5rem" }} /> Add Vehicle
          </Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Total Fleet
            </CardTitle>
            <TruckIcon size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">
              {loading ? (
                <Skeleton width="40px" height="28px" borderRadius="4px" />
              ) : (
                stats.total
              )}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Vehicles registered
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Active
            </CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">
              {loading ? (
                <Skeleton width="40px" height="28px" borderRadius="4px" />
              ) : (
                stats.active
              )}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Currently operational
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Maintenance
            </CardTitle>
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">
              {loading ? (
                <Skeleton width="40px" height="28px" borderRadius="4px" />
              ) : (
                stats.maintenance
              )}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              In service center
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Idle
            </CardTitle>
            <div className="h-2 w-2 rounded-full bg-gray-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">
              {loading ? (
                <Skeleton width="40px" height="28px" borderRadius="4px" />
              ) : (
                stats.idle
              )}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Available for assignment
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg md:text-xl">
              Vehicle List
              {!loading && hasActiveFilters && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({total} of {stats.total})
                </span>
              )}
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <SearchIcon
                  size={16}
                  className="absolute left-2 top-2.5 text-muted-foreground"
                />
                <Input
                  data-testid="vehicles-search-input"
                  placeholder="Search vehicle number..."
                  className="pl-8 pr-8"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="vehicles-search-clear-btn"
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setSearchQuery("");
                      fetchVehicles({ overrideSearch: "", overridePage: 1 });
                    }}
                    className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground h-auto w-auto p-1"
                  >
                    <XIcon size={16} />
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                onClick={openDrawer}
                className="gap-2 shrink-0"
              >
                <SlidersHorizontalIcon size={16} />
                Filters
                {(typeFilter !== "all" ||
                  statusFilter !== "" ||
                  ownerTypeFilter !== "" ||
                  ownerNameFilter !== "" ||
                  fuelTypeFilter !== "") && (
                  <span style={styles.activeFilterBadge}>
                    {(typeFilter !== "all" ? 1 : 0) +
                      (statusFilter !== "" ? 1 : 0) +
                      (ownerTypeFilter !== "" ? 1 : 0) +
                      (ownerNameFilter !== "" ? 1 : 0) +
                      (fuelTypeFilter !== "" ? 1 : 0)}
                  </span>
                )}
              </Button>
              {hasActiveFilters && (
                <Button
                  data-testid="vehicles-filter-clear-btn"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="text-xs"
                >
                  <XIcon size={14} style={{ marginRight: "0.25rem" }} /> Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {(() => {
              if (loading)
                return (
                  <LoadingSpinner
                    size="md"
                    centered
                    label="Loading vehicles..."
                  />
                );
              if (fetchError)
                return (
                  <ErrorState
                    title="Couldn't load vehicles"
                    description={fetchError}
                    onRetry={fetchVehicles}
                  />
                );
              if (vehicles.length === 0) {
                if (hasActiveFilters)
                  return (
                    <EmptyState
                      icon={SearchIcon}
                      title="No Matches Found"
                      description="No vehicles match your current search or filter. Try adjusting your criteria."
                      actionLabel="Clear Filters"
                      onAction={resetFilters}
                    />
                  );
                return (
                  <EmptyState
                    icon={TruckIcon}
                    title="No Vehicles Found"
                    description="You haven’t added any vehicles yet. Add your first vehicle to get started."
                    actionLabel="Add Vehicle"
                    onAction={() => setIsCreateOpen(true)}
                  />
                );
              }
              return (
                <>
                  {vehicles.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">
                          <HighlightMatch
                            text={vehicle.vehicle_number}
                            query={debouncedQuery}
                          />
                        </span>
                        <div className="flex items-center gap-1.5">
                          {vehicle.owner_type === "EXTERNAL" && (
                            <Badge variant="outline">External</Badge>
                          )}
                          <Badge
                            variant={
                              getStatusBadgeVariant(vehicle.status) as
                                | "default"
                                | "destructive"
                                | "secondary"
                                | "outline"
                            }
                          >
                            {vehicle.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {vehicle.vehicle_type === "BUS" ? (
                          <BusIcon size={14} />
                        ) : vehicle.vehicle_type === "CAR" ? (
                          <CarIcon size={14} />
                        ) : vehicle.vehicle_type === "TEMPO_TRAVELLER" ? (
                          <VanIcon size={14} />
                        ) : (
                          <TruckIcon size={14} />
                        )}
                        <span>{getVehicleTypeLabel(vehicle.vehicle_type)}</span>
                        <span className="text-muted-foreground/50">•</span>
                        <span>
                          {vehicle.company} {vehicle.model}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {getVehicleSubDetail(vehicle) !== "—" && (
                          <div>{getVehicleSubDetail(vehicle)}</div>
                        )}
                        <div>Service: {vehicle.last_service_date || "N/A"}</div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          data-testid={`mobile-doc-btn-${vehicle.id}`}
                          variant="secondary"
                          size="sm"
                          className="flex-1 text-xs h-8"
                          onClick={() => {
                            setDocVehicle(vehicle);
                            setIsDocOpen(true);
                          }}
                        >
                          <FolderOpenIcon
                            size={14}
                            style={{ marginRight: "0.25rem" }}
                          />{" "}
                          Docs
                        </Button>
                        {canManage && (
                          <>
                            <Button
                              data-testid={`mobile-edit-btn-${vehicle.id}`}
                              variant="secondary"
                              size="sm"
                              className="text-xs h-8"
                              onClick={() => handleEditClick(vehicle)}
                            >
                              Edit
                            </Button>
                            <Button
                              data-testid={`mobile-delete-btn-${vehicle.id}`}
                              variant="destructive"
                              size="sm"
                              className="text-xs h-8 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(vehicle);
                              }}
                            >
                              <Trash2Icon size={14} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <DataTable<Vehicle>
              columns={[
                {
                  key: "vehicle_number",
                  header: "Vehicle No.",
                  cell: (row) => (
                    <span className="font-medium">
                      <HighlightMatch
                        text={row.vehicle_number}
                        query={debouncedQuery}
                      />
                    </span>
                  ),
                },
                {
                  key: "vehicle_type",
                  header: "Type",
                  cell: (row) => (
                    <div style={styles.cellRow}>
                      <span style={styles.cellIconBadge}>
                        {row.vehicle_type === "BUS" ? (
                          <BusIcon
                            size={14}
                            style={{ color: styles.cellIconColor }}
                          />
                        ) : row.vehicle_type === "CAR" ? (
                          <CarIcon
                            size={14}
                            style={{ color: styles.cellIconColor }}
                          />
                        ) : row.vehicle_type === "TEMPO_TRAVELLER" ? (
                          <VanIcon
                            size={14}
                            style={{ color: styles.cellIconColor }}
                          />
                        ) : (
                          <TruckIcon
                            size={14}
                            style={{ color: styles.cellIconColor }}
                          />
                        )}
                      </span>
                      <span style={styles.cellLabel}>
                        {getVehicleTypeLabel(row.vehicle_type)}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "model",
                  header: "Model",
                  cell: (row) => `${row.company} ${row.model}`,
                },
                {
                  key: "owner_type",
                  header: "Owner Type",
                  cell: (row) => getOwnerTypeLabel(row.owner_type),
                },
                {
                  key: "owner_name",
                  header: "Owner Name",
                  cell: (row) => row.owner_name || "—",
                },
                {
                  key: "details",
                  header: "Details",
                  cell: (row) => getVehicleSubDetail(row),
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (row) => (
                    <Badge
                      variant={
                        getStatusBadgeVariant(row.status) as
                          | "default"
                          | "destructive"
                          | "secondary"
                          | "outline"
                      }
                    >
                      {row.status}
                    </Badge>
                  ),
                },
                {
                  key: "last_service_date",
                  header: "Last Service",
                  cell: (row) => row.last_service_date || "N/A",
                },
                {
                  key: "documents",
                  header: "Documents",
                  cell: (row) => (
                    <Button
                      data-testid={`desktop-doc-btn-${row.id}`}
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setDocVehicle(row);
                        setIsDocOpen(true);
                      }}
                    >
                      <FolderOpenIcon
                        size={16}
                        style={{ marginRight: "0.5rem" }}
                      />{" "}
                      Manage Docs
                    </Button>
                  ),
                },
              ]}
              data={vehicles}
              rowKey={(row) => row.id.toString()}
              loading={loading}
              emptyNode={
                hasActiveFilters ? (
                  <EmptyState
                    icon={SearchIcon}
                    title="No Matches Found"
                    description="No vehicles match your current search or filter. Try adjusting your criteria."
                    actionLabel="Clear Filters"
                    onAction={resetFilters}
                  />
                ) : (
                  <EmptyState
                    icon={TruckIcon}
                    title="No Vehicles Found"
                    description="You haven’t added any vehicles yet. Add your first vehicle to get started."
                    actionLabel="Add Vehicle"
                    onAction={() => setIsCreateOpen(true)}
                  />
                )
              }
              showActions={canManage}
              rowActions={[
                {
                  key: "edit",
                  label: "Edit",
                  icon: <PencilIcon size={14} />,
                  onClick: (row) => handleEditClick(row),
                  hidden: () => !canManage,
                },
                {
                  key: "delete",
                  label: "Delete",
                  icon: <Trash2Icon size={14} />,
                  variant: "danger",
                  onClick: (row) => handleDeleteClick(row),
                  hidden: () => !canManage,
                },
              ]}
            />
          </div>

          {total > 0 && (
            <div className="px-4 md:px-6 pb-4">
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

      {/* Edit Vehicle Modal */}
      <EditVehicleModal
        isOpen={isEditOpen}
        vehicle={editingVehicle}
        onClose={() => setIsEditOpen(false)}
        onSuccess={fetchVehiclesRefetch}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteOpen}
        onOpenChange={(open) => {
          if (!isDeleting) setIsDeleteOpen(open);
        }}
      >
        <ModalContent className="max-w-md p-6 rounded-xl sm:rounded-2xl">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <Trash2Icon size={24} className="text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Delete Vehicle
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Are you sure you want to delete this vehicle? This action cannot
                be undone.
              </p>
            </div>
            {deletingVehicle && (
              <div className="text-sm text-foreground bg-muted p-3 rounded-md w-full">
                <p className="font-medium">{deletingVehicle.vehicle_number}</p>
                <p className="text-muted-foreground">
                  {deletingVehicle.company} {deletingVehicle.model}
                </p>
              </div>
            )}
            {deleteError && (
              <div className="bg-destructive/10 text-destructive p-2 rounded-md text-sm w-full border border-destructive/20 text-left flex justify-between items-start gap-2">
                <span className="flex-1">{deleteError}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setDeleteError(null)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/20 focus:outline-none flex-shrink-0 self-center cursor-pointer h-auto w-auto p-1"
                >
                  <XIcon size={16} />
                </Button>
              </div>
            )}
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsDeleteOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteVehicle}
                disabled={isDeleting}
              >
                {isDeleting && <LoadingSpinner size="sm" className="mr-2" />}
                {isDeleting ? "Deleting..." : "Delete Vehicle"}
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>

      {/* Document Management Modal */}
      <DocumentModal
        isOpen={isDocOpen}
        onClose={() => setIsDocOpen(false)}
        vehicle={docVehicle}
        onUpdate={(documentType, newUrl) => {
          if (documentType && docVehicle) {
            const value = newUrl || null;
            setVehicles((prev) =>
              prev.map((v) =>
                v.id === docVehicle.id ? { ...v, [documentType]: value } : v,
              ),
            );
            setDocVehicle((prev) =>
              prev ? { ...prev, [documentType]: value } : null,
            );
          } else {
            fetchVehiclesRefetch();
          }
        }}
      />

      {/* Create Vehicle Modal */}
      <CreateVehicleModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchVehiclesRefetch}
      />
      {/* ── Filter Drawer ── */}
      <FilterDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onApply={applyDrawerFilters}
      >
        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>Type of Vehicle</Label>
          <Select
            value={drawerFilters.type}
            onValueChange={(v) =>
              setDrawerFilters((p) => ({
                ...p,
                type: v as VehicleType | "all",
              }))
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {VEHICLE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
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
                status: v === "all" ? "" : v,
              }))
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Maintenance">Maintenance</SelectItem>
              <SelectItem value="Idle">Idle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>Fuel</Label>
          <Select
            value={drawerFilters.fuelType || "all"}
            onValueChange={(v) =>
              setDrawerFilters((p) => ({
                ...p,
                fuelType: v === "all" ? "" : v,
              }))
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All Fuel Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fuel Types</SelectItem>
              {FUEL_TYPES.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>Owner Type</Label>
          <Select
            value={drawerFilters.ownerType || "all"}
            onValueChange={(v) =>
              setDrawerFilters((p) => ({
                ...p,
                ownerType: v === "all" ? "" : v,
                // Clear a name that no longer belongs to the newly chosen type.
                ownerName:
                  v === "all"
                    ? p.ownerName
                    : owners.find((o) => o.name === p.ownerName)
                          ?.owner_type === v
                      ? p.ownerName
                      : "",
              }))
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All Owner Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owner Types</SelectItem>
              {OWNER_TYPES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>Owner Name</Label>
          <Select
            value={drawerFilters.ownerName || "all"}
            onValueChange={(v) =>
              setDrawerFilters((p) => ({
                ...p,
                ownerName: v === "all" ? "" : v,
              }))
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All Owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners
                .filter(
                  (o) =>
                    drawerFilters.ownerType === "" ||
                    o.owner_type === drawerFilters.ownerType,
                )
                .map((o) => (
                  <SelectItem key={o.id} value={o.name}>
                    {o.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </FilterDrawer>
    </div>
  );
}
