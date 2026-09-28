"use client";

import { PageHeader } from "@/components/ui/pageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SearchIcon,
  TruckIcon,
  CheckCircleIcon,
  WrenchIcon,
  ClockIcon,
  CarIcon,
  BusIcon,
  VanIcon,
  FolderOpenIcon,
  GridIcon,
  Trash2Icon,
  PencilIcon,
  ArrowLeftIcon,
  XIcon,
  SlidersHorizontalIcon,
} from "@/components/ui/icon";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
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
  DocExpiryStatus,
  DOC_EXPIRY_STATUS_OPTIONS,
} from "./vehicles.types";
import { useVehicleOwners } from "@/hooks/useVehicleOwners";
import {
  getStatusBadgeVariant,
  getVehicleTypeLabel,
  getVehicleSubDetail,
  getOwnerTypeLabel,
  getDocExpiryBadgeVariant,
  formatDocDate,
} from "./vehicles.utils";
import HighlightMatch from "./highlightMatch";
import * as styles from "./vehiclesPage.style";
import {
  CA_VEHICLES_CONTAINER,
} from "./vehicles.styles";
import { Skeleton } from "@/components/skeletonLoader";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";

// Lazy-loaded: only needed once a user opens one of these modals, so they
// shouldn't bloat the initial page chunk that has to load before anything
// (including the skeleton) can paint.
const DocumentModal = dynamic(
  () => import("@/components/documentModal").then((m) => m.DocumentModal),
  { ssr: false },
);
const VehicleImagesModal = dynamic(
  () => import("@/components/vehicleImagesModal").then((m) => m.VehicleImagesModal),
  { ssr: false },
);
const CreateVehicleModal = dynamic(
  () =>
    import("@/components/createVehicleModal").then((m) => m.CreateVehicleModal),
  { ssr: false },
);
const EditVehicleModal = dynamic(
  () => import("@/components/editVehicleModal").then((m) => m.EditVehicleModal),
  { ssr: false },
);
import { ErrorState } from "@/components/errorState";
import { deleteVehicle } from "@/services/vehiclesService";
import { EmptyState } from "@/components/emptyState";
import { Pagination } from "@/components/pagination";
import { DataTable } from "@/components/ui/dataTable";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/statCard";
import {
  FilterDrawer,
  fieldGroup as filterFieldGroup,
  fieldLabel as filterFieldLabel,
} from "@/components/ui/filterDrawer";

/** Renders one document type's expiry badge + validity date range (used per-column on desktop, stacked on mobile). */
function DocExpiryCell({
  label,
  status,
  start,
  end,
}: {
  label: string;
  status: DocExpiryStatus | null | undefined;
  start: string | null | undefined;
  end: string | null | undefined;
}) {
  if (!start && !end) return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <div className="flex items-center gap-1.5">
      {status && (
        <Badge variant={getDocExpiryBadgeVariant(status) ?? "outline"}>{label}</Badge>
      )}
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {start ? formatDocDate(start) : "No Start Date"} –{" "}
        {end ? formatDocDate(end) : "No End Date"}
      </span>
    </div>
  );
}

export default function VehiclesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [fcStatusFilter, setFcStatusFilter] = useState<string>(
    searchParams.get("fcStatus") || "",
  );
  const [insuranceStatusFilter, setInsuranceStatusFilter] = useState<string>(
    searchParams.get("insuranceStatus") || "",
  );
  const [drawerFilters, setDrawerFilters] = useState<{
    type: VehicleType | "all";
    status: string;
    ownerType: string;
    ownerName: string;
    fuelType: string;
    fcStatus: string;
    insuranceStatus: string;
  }>({
    type: (searchParams.get("type") as VehicleType | "all") || "all",
    status: searchParams.get("status") || "",
    ownerType: searchParams.get("ownerType") || "",
    ownerName: searchParams.get("ownerName") || "",
    fuelType: searchParams.get("fuelType") || "",
    fcStatus: searchParams.get("fcStatus") || "",
    insuranceStatus: searchParams.get("insuranceStatus") || "",
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
    fuelTypeFilter !== "" ||
    fcStatusFilter !== "" ||
    insuranceStatusFilter !== "";

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
      fcStatus: string,
      insuranceStatus: string,
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
      if (fcStatus) params.set("fcStatus", fcStatus);
      if (insuranceStatus) params.set("insuranceStatus", insuranceStatus);
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
      overrideFcStatus?: string;
      overrideInsuranceStatus?: string;
    }) => {
      const p = opts?.overridePage ?? page;
      const ps = opts?.overridePageSize ?? pageSize;
      const search = opts?.overrideSearch ?? debouncedQuery;
      const type = opts?.overrideType ?? typeFilter;
      const st = opts?.overrideStatus ?? statusFilter;
      const ot = opts?.overrideOwnerType ?? ownerTypeFilter;
      const on = opts?.overrideOwnerName ?? ownerNameFilter;
      const ft = opts?.overrideFuelType ?? fuelTypeFilter;
      const fcs = opts?.overrideFcStatus ?? fcStatusFilter;
      const ins = opts?.overrideInsuranceStatus ?? insuranceStatusFilter;

      const requestId = ++requestIdRef.current;

      setLoading(true);
      setFetchError(null);
      // Optimistic URL sync
      syncUrl(p, ps, search, type, st, ot, on, ft, fcs, ins);

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
        if (fcs) params.set("fcStatus", fcs);
        if (ins) params.set("insuranceStatus", ins);

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
        setFcStatusFilter(fcs);
        setInsuranceStatusFilter(ins);
      } catch {
        if (requestIdRef.current !== requestId) return;
        setFetchError(
          "We couldn\u2019t load your vehicles. Please check your connection and try again.",
        );
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
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
      fcStatusFilter,
      insuranceStatusFilter,
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
      fcStatus: fcStatusFilter,
      insuranceStatus: insuranceStatusFilter,
    });
    setIsDrawerOpen(true);
  };

  const applyDrawerFilters = () => {
    setTypeFilter(drawerFilters.type);
    setStatusFilter(drawerFilters.status);
    setOwnerTypeFilter(drawerFilters.ownerType);
    setOwnerNameFilter(drawerFilters.ownerName);
    setFuelTypeFilter(drawerFilters.fuelType);
    setFcStatusFilter(drawerFilters.fcStatus);
    setInsuranceStatusFilter(drawerFilters.insuranceStatus);
    setPage(1);
    setIsDrawerOpen(false);
    fetchVehicles({
      overrideType: drawerFilters.type,
      overrideStatus: drawerFilters.status,
      overrideOwnerType: drawerFilters.ownerType,
      overrideOwnerName: drawerFilters.ownerName,
      overrideFuelType: drawerFilters.fuelType,
      overrideFcStatus: drawerFilters.fcStatus,
      overrideInsuranceStatus: drawerFilters.insuranceStatus,
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
    setFcStatusFilter("");
    setInsuranceStatusFilter("");
    setDrawerFilters({
      type: "all",
      status: "",
      ownerType: "",
      ownerName: "",
      fuelType: "",
      fcStatus: "",
      insuranceStatus: "",
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
      overrideFcStatus: "",
      overrideInsuranceStatus: "",
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
  const [isImagesOpen, setIsImagesOpen] = useState(false);
  const [imagesVehicle, setImagesVehicle] = useState<Vehicle | null>(null);

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

  if (authLoading) return <PageLoadingSkeleton variant="admin" />;
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
        className="mb-2 w-fit -ml-2 text-muted-foreground hover:text-foreground max-md:hidden"
      >
        <ArrowLeftIcon size={16} style={{ marginRight: "0.5rem" }} />
        Back
      </Button>
      <PageHeader
        title="Vehicles"
        description="Manage your fleet of buses, cars, and trucks."
        primaryAction={
          canEdit
            ? { label: "Add Vehicle", testId: "vehicles-add-btn", onClick: () => setIsCreateOpen(true) }
            : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          title="Total Fleet"
          value={loading ? <Skeleton width="40px" height="28px" borderRadius="4px" /> : stats.total}
          icon={<TruckIcon size={18} />}
          subtext={<span className="hidden sm:inline">Vehicles registered</span>}
        />
        <StatCard
          title="Active"
          value={loading ? <Skeleton width="40px" height="28px" borderRadius="4px" /> : stats.active}
          icon={<CheckCircleIcon size={18} />}
          tone="positive"
          subtext={<span className="hidden sm:inline">Currently operational</span>}
        />
        <StatCard
          title="Maintenance"
          value={loading ? <Skeleton width="40px" height="28px" borderRadius="4px" /> : stats.maintenance}
          icon={<WrenchIcon size={18} />}
          tone={stats.maintenance > 0 ? "warning" : "neutral"}
          subtext={<span className="hidden sm:inline">In service center</span>}
        />
        <StatCard
          title="Idle"
          value={loading ? <Skeleton width="40px" height="28px" borderRadius="4px" /> : stats.idle}
          icon={<ClockIcon size={18} />}
          subtext={<span className="hidden sm:inline">Available for assignment</span>}
        />
      </div>

      <Card className="ss-panel">
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
            <div className="flex flex-row gap-2 w-full sm:w-auto">
              <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                <SearchIcon
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  data-testid="vehicles-search-input"
                  placeholder="Search vehicle number..."
                  className="pl-9 pr-8"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground h-auto w-auto p-1"
                  >
                    <XIcon size={16} />
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                onClick={openDrawer}
                aria-label="Filters"
                className="gap-2 shrink-0 max-sm:h-11 max-sm:gap-1.5 max-sm:px-3"
              >
                <SlidersHorizontalIcon size={16} />
                <span className="max-sm:sr-only">Filters</span>
                {(typeFilter !== "all" ||
                  statusFilter !== "" ||
                  ownerTypeFilter !== "" ||
                  ownerNameFilter !== "" ||
                  fuelTypeFilter !== "" ||
                  fcStatusFilter !== "" ||
                  insuranceStatusFilter !== "") && (
                  <span style={styles.activeFilterBadge}>
                    {(typeFilter !== "all" ? 1 : 0) +
                      (statusFilter !== "" ? 1 : 0) +
                      (ownerTypeFilter !== "" ? 1 : 0) +
                      (ownerNameFilter !== "" ? 1 : 0) +
                      (fuelTypeFilter !== "" ? 1 : 0) +
                      (fcStatusFilter !== "" ? 1 : 0) +
                      (insuranceStatusFilter !== "" ? 1 : 0)}
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

          {/* Table — DataTable renders it as cards below md */}
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
                mobile: "subtitle",
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
                key: "documents",
                header: "Documents",
                mobile: "hidden",
                cell: (row) => (
                  <div className="flex gap-2">
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
                    <Button
                      data-testid={`desktop-images-btn-${row.id}`}
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setImagesVehicle(row);
                        setIsImagesOpen(true);
                      }}
                    >
                      Images
                    </Button>
                  </div>
                ),
              },
              {
                key: "model",
                header: "Model",
                mobile: "subtitle",
                cell: (row) =>
                  [row.company, row.model].filter(Boolean).join(" ") || "—",
              },
              {
                key: "owner_type",
                header: "Owner Type",
                mobile: "hidden",
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
                className: "whitespace-nowrap",
                cell: (row) => getVehicleSubDetail(row),
              },
              {
                key: "status",
                header: "Status",
                mobile: "trailing",
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
                key: "fc_status",
                header: "FC",
                cell: (row) => (
                  <DocExpiryCell
                    label="FC"
                    status={row.fc_status}
                    start={row.fc_start_date}
                    end={row.fc_end_date}
                  />
                ),
              },
              {
                key: "insurance_status",
                header: "Insurance",
                cell: (row) => (
                  <DocExpiryCell
                    label="Insurance"
                    status={row.insurance_status}
                    start={row.insurance_start_date}
                    end={row.insurance_end_date}
                  />
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
              // Desktop has these as buttons in the Documents column;
              // on phones they join the card's "⋯" sheet.
              {
                key: "documents",
                label: "Documents",
                icon: <FolderOpenIcon size={14} />,
                onClick: (row) => {
                  setDocVehicle(row);
                  setIsDocOpen(true);
                },
                mobileOnly: true,
              },
              {
                key: "images",
                label: "Images",
                icon: <GridIcon size={14} />,
                onClick: (row) => {
                  setImagesVehicle(row);
                  setIsImagesOpen(true);
                },
                mobileOnly: true,
              },
              ...(canManage
                ? [
                    {
                      key: "edit",
                      label: "Edit",
                      icon: <PencilIcon size={14} />,
                      onClick: (row: Vehicle) => handleEditClick(row),
                    },
                    {
                      key: "delete",
                      label: "Delete",
                      icon: <Trash2Icon size={14} />,
                      variant: "danger" as const,
                      onClick: (row: Vehicle) => handleDeleteClick(row),
                    },
                  ]
                : []),
            ]}
          />
        

          {total > 0 && (
            <div className="px-4 pb-4 md:px-6 max-md:p-0">
              <Pagination
                page={page}
                totalCount={total}
                pageSize={pageSize}
                loading={loading}
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
                data-testid="vehicles-delete-confirm-btn"
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
          // fc_status/insurance_status are computed server-side from these
          // date columns — a local patch can't refresh them, so refetch.
          const isExpiryDateField =
            documentType === "fc_start_date" ||
            documentType === "fc_end_date" ||
            documentType === "insurance_start_date" ||
            documentType === "insurance_end_date";

          if (documentType && docVehicle && !isExpiryDateField) {
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

      {/* Vehicle Images Modal */}
      {imagesVehicle && (
        <VehicleImagesModal
          isOpen={isImagesOpen}
          onClose={() => setIsImagesOpen(false)}
          vehicleId={imagesVehicle.id}
          vehicleNumber={imagesVehicle.vehicle_number}
          canManage={canManage}
        />
      )}

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
          <Label style={filterFieldLabel}>FC Status</Label>
          <Select
            value={drawerFilters.fcStatus || "all"}
            onValueChange={(v) =>
              setDrawerFilters((p) => ({
                ...p,
                fcStatus: v === "all" ? "" : v,
              }))
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              {DOC_EXPIRY_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value || "all"} value={o.value || "all"}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div style={filterFieldGroup}>
          <Label style={filterFieldLabel}>Insurance Status</Label>
          <Select
            value={drawerFilters.insuranceStatus || "all"}
            onValueChange={(v) =>
              setDrawerFilters((p) => ({
                ...p,
                insuranceStatus: v === "all" ? "" : v,
              }))
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              {DOC_EXPIRY_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value || "all"} value={o.value || "all"}>
                  {o.label}
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
