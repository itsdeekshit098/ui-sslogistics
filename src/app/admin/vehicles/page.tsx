"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PlusIcon,
  SearchIcon,
  TruckIcon,
  CarIcon,
  BusIcon,
  SaveIcon,
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
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Vehicle, VehicleType, VEHICLE_TYPES } from "./vehicles.types";
import {
  getDefaultVehicleFormData,
  getStatusBadgeVariant,
} from "./vehicles.utils";
import HighlightMatch from "./highlightMatch";
import * as styles from "./vehiclesPage.style";
import {
  CA_VEHICLES_CONTAINER,
  CA_VEHICLES_HEADER_TITLE,
  CA_VEHICLES_HEADER_DESC,
  CA_MODAL_GRID,
  CA_MODAL_LABEL_SPACE,
} from "./vehicles.styles";
import { DocumentModal } from "@/components/documentModal";
import { Skeleton } from "@/components/skeletonLoader";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { CreateVehicleModal } from "@/components/createVehicleModal";
import { ErrorState } from "@/components/errorState";
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
  const isAdmin = userRole === "admin";
  const canWrite = isAdmin || userRole === "staff";

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
  const [drawerFilters, setDrawerFilters] = useState<{
    type: VehicleType | "all";
    status: string;
  }>({
    type: (searchParams.get("type") as VehicleType | "all") || "all",
    status: searchParams.get("status") || "",
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters =
    searchQuery !== "" || typeFilter !== "all" || statusFilter !== "";

  // ─── URL sync ───
  const syncUrl = useCallback(
    (
      p: number,
      ps: number,
      search: string,
      type: VehicleType | "all",
      status: string,
    ) => {
      const params = new URLSearchParams();
      if (p > 1) params.set("page", String(p));
      if (ps !== 10) params.set("pageSize", String(ps));
      if (search) params.set("search", search);
      if (type !== "all") params.set("type", type);
      if (status) params.set("status", status);
      const qs = params.toString();
      router.replace(`/admin/vehicles${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [router],
  );

  // ─── Atomic fetch — accepts explicit params to avoid stale-state cascades ───
  const fetchVehicles = useCallback(
    async (opts?: {
      overridePage?: number;
      overridePageSize?: number;
      overrideSearch?: string;
      overrideType?: VehicleType | "all";
      overrideStatus?: string;
    }) => {
      const p = opts?.overridePage ?? page;
      const ps = opts?.overridePageSize ?? pageSize;
      const search = opts?.overrideSearch ?? debouncedQuery;
      const type = opts?.overrideType ?? typeFilter;
      const st = opts?.overrideStatus ?? statusFilter;

      setLoading(true);
      setFetchError(null);
      // Optimistic URL sync
      syncUrl(p, ps, search, type, st);

      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(ps),
        });
        if (search) params.set("search", search);
        if (type !== "all") params.set("type", type);
        if (st) params.set("status", st);

        const res = await fetch(`/api/vehicles?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");

        const json = await res.json();
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
      } catch {
        setFetchError(
          "We couldn\u2019t load your vehicles. Please check your connection and try again.",
        );
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [page, pageSize, debouncedQuery, typeFilter, statusFilter, syncUrl],
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
    setDrawerFilters({ type: typeFilter, status: statusFilter });
    setIsDrawerOpen(true);
  };

  const applyDrawerFilters = () => {
    setTypeFilter(drawerFilters.type);
    setStatusFilter(drawerFilters.status);
    setPage(1);
    setIsDrawerOpen(false);
    fetchVehicles({
      overrideType: drawerFilters.type,
      overrideStatus: drawerFilters.status,
      overridePage: 1,
    });
  };

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setTypeFilter("all");
    setStatusFilter("");
    setDrawerFilters({ type: "all", status: "" });
    setIsDrawerOpen(false);
    setPage(1);
    fetchVehicles({
      overrideSearch: "",
      overrideType: "all",
      overrideStatus: "",
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
  const [editFormData, setEditFormData] = useState<Omit<Vehicle, "id">>(
    getDefaultVehicleFormData(),
  );
  const [editErrors, setEditErrors] = useState<{
    vehicle_number?: string;
    vehicle_type?: string;
  }>({});
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);

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
  const [isSaving, setIsSaving] = useState(false);

  const fetchVehiclesRefetch = useCallback(() => {
    // Re-fetch current page (used after create/edit/delete)
    fetchVehicles();
  }, [fetchVehicles]);

  const handleEditClick = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setEditFormData({
      vehicle_number: vehicle.vehicle_number || "",
      vehicle_type: vehicle.vehicle_type || "",
      company: vehicle.company || "",
      model: vehicle.model || "",
      capacity: vehicle.capacity || "",
      status: vehicle.status || "Active",
      last_service_date: vehicle.last_service_date || "",
      rc_url: vehicle.rc_url || "",
      insurance_url: vehicle.insurance_url || "",
      fc_url: vehicle.fc_url || "",
      permit_url: vehicle.permit_url || "",
      pollution_url: vehicle.pollution_url || "",
      tax_url: vehicle.tax_url || "",
      expected_kml: vehicle.expected_kml ?? null,
      tank_capacity: vehicle.tank_capacity ?? null,
      fuel_type: vehicle.fuel_type || "Diesel",
    });
    setEditErrors({});
    setEditSubmitError(null);
    setIsEditOpen(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleEditSelectChange = (field: string, value: string) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleUpdateVehicle = async () => {
    if (!editingVehicle) return;

    const newErrors: { vehicle_number?: string; vehicle_type?: string } = {};
    if (
      !editFormData.vehicle_number ||
      editFormData.vehicle_number.trim() === ""
    ) {
      newErrors.vehicle_number = "Vehicle Number is required";
    }
    if (!editFormData.vehicle_type || editFormData.vehicle_type.trim() === "") {
      newErrors.vehicle_type = "Vehicle Type is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setEditErrors(newErrors);
      return;
    }
    setEditErrors({});

    setEditSubmitError(null);
    setIsSaving(true);

    const payload = {
      id: editingVehicle.id,
      ...editFormData,
      last_service_date: editFormData.last_service_date
        ? editFormData.last_service_date
        : null,
    };

    try {
      const res = await fetch("/api/vehicles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setEditSubmitError(
          `Failed to update vehicle: ${errorData.error || res.statusText}`,
        );
        return;
      }

      // Refetch to get fresh data from the server
      await fetchVehicles();
      setIsEditOpen(false);
    } catch {
      setEditSubmitError("Unexpected error updating vehicle.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (vehicle: Vehicle) => {
    setDeletingVehicle(vehicle);
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  const handleDeleteVehicle = async () => {
    if (!deletingVehicle) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/vehicles?id=${deletingVehicle.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        setDeleteError(
          `Failed to delete vehicle: ${errorData.error || res.statusText}`,
        );
        return;
      }

      // Refetch to get fresh data from the server
      await fetchVehicles();

      setIsDeleteOpen(false);
      setDeletingVehicle(null);
    } catch {
      setDeleteError("Unexpected error deleting vehicle.");
    } finally {
      setIsDeleting(false);
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
        {canWrite && (
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
              Vehicle Lists
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
                  <button
                    data-testid="vehicles-search-clear-btn"
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      fetchVehicles({ overrideSearch: "", overridePage: 1 });
                    }}
                    className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon size={16} />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                onClick={openDrawer}
                className="gap-2 shrink-0"
              >
                <SlidersHorizontalIcon size={16} />
                Filters
                {(typeFilter !== "all" || statusFilter !== "") && (
                  <span style={styles.activeFilterBadge}>
                    {(typeFilter !== "all" ? 1 : 0) +
                      (statusFilter !== "" ? 1 : 0)}
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
            {loading ? (
              <LoadingSpinner size="md" centered label="Loading vehicles..." />
            ) : fetchError ? (
              <ErrorState
                title="Couldn't load vehicles"
                description={fetchError}
                onRetry={fetchVehicles}
              />
            ) : vehicles.length === 0 ? (
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
                  description="You haven\u2019t added any vehicles yet. Add your first vehicle to get started."
                  actionLabel="Add Vehicle"
                  onAction={() => setIsCreateOpen(true)}
                />
              )
            ) : (
              vehicles.map((vehicle) => (
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {vehicle.vehicle_type === "Bus" ? (
                      <BusIcon size={14} />
                    ) : vehicle.vehicle_type === "Car" ? (
                      <CarIcon size={14} />
                    ) : vehicle.vehicle_type === "Tempo Traveller" ||
                      vehicle.vehicle_type === "Tempo" ? (
                      <VanIcon size={14} />
                    ) : (
                      <TruckIcon size={14} />
                    )}
                    <span>{vehicle.vehicle_type}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>
                      {vehicle.company} {vehicle.model}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Capacity: {vehicle.capacity} | Service:{" "}
                    {vehicle.last_service_date || "N/A"}
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
                    {canWrite && (
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
                        {isAdmin && (
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
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
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
                        {row.vehicle_type === "Bus" ? (
                          <BusIcon
                            size={14}
                            style={{ color: styles.cellIconColor }}
                          />
                        ) : row.vehicle_type === "Car" ? (
                          <CarIcon
                            size={14}
                            style={{ color: styles.cellIconColor }}
                          />
                        ) : row.vehicle_type === "Tempo Traveller" ||
                          row.vehicle_type === "Tempo" ? (
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
                      <span style={styles.cellLabel}>{row.vehicle_type}</span>
                    </div>
                  ),
                },
                {
                  key: "model",
                  header: "Model",
                  cell: (row) => `${row.company} ${row.model}`,
                },
                {
                  key: "capacity",
                  header: "Capacity",
                  cell: (row) => row.capacity,
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
              rowActions={[
                {
                  key: "edit",
                  label: "Edit",
                  icon: <PencilIcon size={14} />,
                  onClick: (row) => handleEditClick(row),
                  hidden: () => !canWrite,
                },
                {
                  key: "delete",
                  label: "Delete",
                  icon: <Trash2Icon size={14} />,
                  variant: "danger",
                  onClick: (row) => handleDeleteClick(row),
                  hidden: () => !isAdmin,
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
      <Modal open={isEditOpen} onOpenChange={setIsEditOpen}>
        <ModalContent className="w-[95vw] max-w-175 p-0 overflow-hidden rounded-xl sm:rounded-2xl">
          <div className="max-h-[85vh] overflow-y-auto p-4 md:p-6 scrollbar-custom">
            <ModalHeader>
              <ModalTitle>Edit Vehicle</ModalTitle>
              <ModalDescription>
                Make changes to the vehicle details here. Click save when
                you&apos;re done.
              </ModalDescription>
            </ModalHeader>
            {editSubmitError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-2 border border-red-100 flex justify-between items-start gap-2">
                <span>{editSubmitError}</span>
                <button
                  type="button"
                  onClick={() => setEditSubmitError(null)}
                  className="text-red-600 hover:text-red-800 focus:outline-none flex-shrink-0 mt-0.5"
                >
                  <XIcon size={16} />
                </button>
              </div>
            )}
            <div className="grid gap-4 py-4">
              <div className={CA_MODAL_GRID}>
                <div className={CA_MODAL_LABEL_SPACE}>
                  <Label htmlFor="vehicle_number">
                    Vehicle Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="vehicle_number"
                    value={editFormData.vehicle_number}
                    onChange={(e) => {
                      handleEditChange(e);
                      if (editErrors.vehicle_number)
                        setEditErrors((prev) => ({
                          ...prev,
                          vehicle_number: undefined,
                        }));
                    }}
                    className={
                      editErrors.vehicle_number
                        ? "border-red-500 focus-visible:ring-red-500"
                        : ""
                    }
                  />
                  {editErrors.vehicle_number && (
                    <p className="text-xs text-red-500 mt-1">
                      {editErrors.vehicle_number}
                    </p>
                  )}
                </div>
                <div className={CA_MODAL_LABEL_SPACE}>
                  <Label htmlFor="vehicle_type">
                    Vehicle Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={editFormData.vehicle_type}
                    onValueChange={(value) => {
                      handleEditSelectChange("vehicle_type", value);
                      if (editErrors.vehicle_type)
                        setEditErrors((prev) => ({
                          ...prev,
                          vehicle_type: undefined,
                        }));
                    }}
                  >
                    <SelectTrigger
                      className={
                        editErrors.vehicle_type
                          ? "border-red-500 focus:ring-red-500"
                          : ""
                      }
                    >
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bus">Bus</SelectItem>
                      <SelectItem value="Car">Car</SelectItem>
                      <SelectItem value="Tempo">Tempo Traveller</SelectItem>
                      <SelectItem value="Truck">Truck</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={CA_MODAL_GRID}>
                <div className={CA_MODAL_LABEL_SPACE}>
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={editFormData.company}
                    onChange={handleEditChange}
                  />
                </div>
                <div className={CA_MODAL_LABEL_SPACE}>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={editFormData.model}
                    onChange={handleEditChange}
                  />
                </div>
              </div>

              <div className={CA_MODAL_GRID}>
                <div className={CA_MODAL_LABEL_SPACE}>
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    value={editFormData.capacity}
                    onChange={handleEditChange}
                  />
                </div>
                <div className={CA_MODAL_LABEL_SPACE}>
                  <Label htmlFor="last_service_date">Last Service Date</Label>
                  <Input
                    id="last_service_date"
                    type="date"
                    value={editFormData.last_service_date || ""}
                    onChange={handleEditChange}
                  />
                </div>
              </div>

              <div className={CA_MODAL_GRID}>
                <div className={CA_MODAL_LABEL_SPACE}>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={editFormData.status}
                    onValueChange={(value) =>
                      handleEditSelectChange("status", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                      <SelectItem value="Idle">Idle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={CA_MODAL_LABEL_SPACE}>
                  <Label htmlFor="fuel_type">Fuel Type</Label>
                  <Select
                    value={editFormData.fuel_type || "Diesel"}
                    onValueChange={(value) =>
                      handleEditSelectChange("fuel_type", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Fuel Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Diesel">Diesel</SelectItem>
                      <SelectItem value="Petrol">Petrol</SelectItem>
                      <SelectItem value="CNG">CNG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={CA_MODAL_GRID}>
                <div className={CA_MODAL_LABEL_SPACE}>
                  <Label htmlFor="expected_kml">Expected Km/L</Label>
                  <Input
                    id="expected_kml"
                    type="number"
                    placeholder="e.g. 4.5"
                    step="0.01"
                    min="0"
                    value={editFormData.expected_kml ?? ""}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        expected_kml: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      }))
                    }
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
                <div className={CA_MODAL_LABEL_SPACE}>
                  <Label htmlFor="tank_capacity">Tank Capacity (L)</Label>
                  <Input
                    id="tank_capacity"
                    type="number"
                    placeholder="e.g. 200"
                    step="0.01"
                    min="0"
                    value={editFormData.tank_capacity ?? ""}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        tank_capacity: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      }))
                    }
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
              </div>
            </div>
            <ModalFooter>
              <Button
                type="submit"
                onClick={handleUpdateVehicle}
                disabled={isSaving}
              >
                {isSaving ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
                )}
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </ModalFooter>
          </div>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <ModalContent className="max-w-md rounded-xl sm:rounded-2xl">
          <div className="flex flex-col items-center space-y-2 text-center">
            <div className="rounded-full bg-red-100 p-3">
              <Trash2Icon size={24} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Vehicle
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Are you sure you want to delete this vehicle? This action cannot
                be undone.
              </p>
            </div>
            {deletingVehicle && (
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md w-full">
                <p className="font-medium">{deletingVehicle.vehicle_number}</p>
                <p className="text-gray-600">
                  {deletingVehicle.company} {deletingVehicle.model}
                </p>
              </div>
            )}
            {deleteError && (
              <div className="bg-red-50 text-red-600 p-2 rounded-md text-sm w-full border border-red-100 text-left flex justify-between items-start gap-2">
                <span className="flex-1">{deleteError}</span>
                <button
                  type="button"
                  onClick={() => setDeleteError(null)}
                  className="text-red-600 hover:text-red-800 focus:outline-none flex-shrink-0 self-center cursor-pointer"
                >
                  <XIcon size={16} />
                </button>
              </div>
            )}
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsDeleteOpen(false)}
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
          <label style={filterFieldLabel}>Type of Vehicle</label>
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
                <SelectItem key={t} value={t}>
                  {t === "Tempo" ? "Tempo Traveller" : t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div style={filterFieldGroup}>
          <label style={filterFieldLabel}>Status</label>
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
      </FilterDrawer>
    </div>
  );
}
