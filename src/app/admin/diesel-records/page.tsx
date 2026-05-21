"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  AlertTriangleIcon,
  ArrowLeftIcon,
} from "@/components/ui/icon";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreateDieselModal } from "@/components/createDieselModal";
import { EditDieselModal } from "@/components/editDieselModal";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { Pagination } from "@/components/pagination";
import { Typeahead } from "@/components/typeahead";
import { useAuth } from "@/context/AuthContext";
import type { DieselRecordWithVehicle } from "./dieselRecords.types";
import { RefreshCwIcon, FuelIcon } from "@/components/ui/icon";
import { DataTable } from "@/components/ui/dataTable";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { ConfirmModal } from "@/components/confirmModal";

interface VehicleOption {
  id: number;
  vehicle_number: string;
  company: string;
  model: string;
  expected_kml: number | null;
  tank_capacity: number | null;
}

export default function DieselRecordsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialise from URL params
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    searchParams.get("vehicle_id") || "",
  );
  const [records, setRecords] = useState<DieselRecordWithVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { userRole, loading: authLoading } = useAuth();
  const [deleteTarget, setDeleteTarget] =
    useState<DieselRecordWithVehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<DieselRecordWithVehicle | null>(
    null,
  );
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(
    Number(searchParams.get("pageSize")) || 10,
  );
  const [totalRecords, setTotalRecords] = useState(0);

  // Fetch vehicles
  const fetchVehicles = useCallback(async () => {
    setVehiclesLoading(true);
    setVehiclesError(null);
    try {
      const res = await fetch("/api/vehicles");
      if (res.ok) {
        const json = await res.json();
        setVehicles(json.data?.data ?? []);
      } else {
        setVehiclesError("Failed to load vehicles. Please try again.");
      }
    } catch {
      setVehiclesError("Network error loading vehicles. Please try again.");
    } finally {
      setVehiclesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // Sync state to URL
  const updateUrl = useCallback(
    (vehicleId: string, p: number, ps: number) => {
      const params = new URLSearchParams();
      if (vehicleId) params.set("vehicle_id", vehicleId);
      if (p > 1) params.set("page", String(p));
      if (ps !== 10) params.set("pageSize", String(ps));
      const qs = params.toString();
      router.replace(`/admin/diesel-records${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [router],
  );

  // Fetch diesel records when vehicle/page/pageSize changes
  const fetchRecords = useCallback(async () => {
    if (!selectedVehicleId) {
      setRecords([]);
      setTotalRecords(0);
      return;
    }
    setLoading(true);
    setRecordsError(null);
    try {
      const res = await fetch(
        `/api/diesel-records?vehicle_id=${selectedVehicleId}&page=${page}&pageSize=${pageSize}`,
      );
      if (res.ok) {
        const json = await res.json();
        const result = json.data ?? {};
        setRecords(result.data);
        setTotalRecords(result.total);
      } else {
        setRecordsError("Failed to load diesel records. Please try again.");
      }
    } catch {
      setRecordsError(
        "Network error loading records. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedVehicleId, page, pageSize]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Update URL whenever vehicle/page/pageSize changes
  useEffect(() => {
    updateUrl(selectedVehicleId, page, pageSize);
  }, [selectedVehicleId, page, pageSize, updateUrl]);

  const handleDeleteClick = (record: DieselRecordWithVehicle) => {
    setDeleteTarget(record);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/diesel-records?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        fetchRecords();
      } else {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete record");
      }
    } catch {
      setDeleteError("Network error deleting record");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVehicleChange = (id: string) => {
    setSelectedVehicleId(id);
    setPage(1); // Reset to page 1 on vehicle change
  };

  const handlePageChange = (p: number) => {
    setPage(p);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1); // Reset to page 1 on page size change
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      date: d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      time: d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const displayVal = (val: number | null | undefined, suffix = "") =>
    val !== null && val !== undefined ? `${val}${suffix}` : "—";

  const getRecordWarnings = (record: DieselRecordWithVehicle): string[] => {
    const w: string[] = [];
    const tank = record.vehicles?.tank_capacity;
    if (tank && record.fuel_litres > tank) {
      w.push(`Fuel (${record.fuel_litres}L) exceeds tank capacity (${tank}L)`);
    }
    if (
      record.fill_type === "full" &&
      tank &&
      record.fuel_litres < tank * 0.3 &&
      record.fuel_litres > 0
    ) {
      w.push(`Only ${record.fuel_litres}L for a full fill? Tank is ${tank}L`);
    }
    return w;
  };

  if (authLoading || vehiclesLoading)
    return <PageLoadingSkeleton variant="admin" />;
  if (vehiclesError && vehicles.length === 0)
    return (
      <ErrorState
        title="Error"
        description={vehiclesError}
        onRetry={fetchVehicles}
      />
    );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="container mx-auto px-3 py-3 md:p-6 space-y-4 md:space-y-8">
        <Button
          data-testid="diesel-back-btn"
          variant="ghost"
          onClick={() => router.back()}
          className="mb-2 w-fit -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon size={16} style={{ marginRight: "0.5rem" }} />
          Back
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Diesel Records
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Track fuel consumption, cycles, and efficiency for all vehicles.
            </p>
          </div>
          {(userRole === "admin" ||
            userRole === "driver" ||
            userRole === "staff") && (
            <Button
              data-testid="admin-diesel-add-btn"
              className="w-full md:w-auto"
              onClick={() => setIsCreateOpen(true)}
              disabled={vehiclesLoading || !!vehiclesError}
            >
              {vehiclesLoading ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <PlusIcon size={16} style={{ marginRight: "0.5rem" }} />
              )}
              {vehiclesLoading ? "Loading Vehicles..." : "Add Diesel Entry"}
            </Button>
          )}
        </div>

        {(userRole === "admin" || userRole === "staff") && (
          <>
            <div className="flex items-center gap-4">
              <Typeahead
                id="diesel-records-vehicle"
                data-testid="diesel-records-vehicle-typeahead"
                className="w-full sm:w-[280px]"
                options={vehicles}
                value={selectedVehicleId}
                onValueChange={handleVehicleChange}
                getOptionValue={(vehicle) => vehicle.id.toString()}
                getOptionLabel={(vehicle) =>
                  `${vehicle.vehicle_number} — ${vehicle.company} ${vehicle.model}`.trim()
                }
                getOptionKeywords={(vehicle) => [
                  vehicle.vehicle_number,
                  vehicle.company,
                  vehicle.model,
                ]}
                placeholder={
                  vehiclesLoading ? "Loading vehicles..." : "Search vehicle..."
                }
                emptyMessage="No vehicles found."
                disabled={vehiclesLoading || Boolean(vehiclesError)}
              />
              {vehiclesError && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchVehicles}
                  className="shrink-0"
                >
                  <RefreshCwIcon size={16} style={{ marginRight: "0.25rem" }} /> Retry
                </Button>
              )}
            </div>
            {vehiclesError && !vehiclesLoading && (
              <ErrorState
                title="Couldn't load vehicles"
                description={vehiclesError}
                onRetry={fetchVehicles}
              />
            )}

            {!vehiclesLoading && !vehiclesError && !selectedVehicleId && (
              <EmptyState
                icon={FuelIcon}
                title="Select a Vehicle"
                description="Choose a vehicle from the dropdown above to view its diesel records."
              />
            )}

            {(userRole === "admin" || userRole === "staff") &&
              selectedVehicleId && (
                <Card>
                  <CardHeader className="p-3 md:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="text-lg md:text-xl">
                        Records for{" "}
                        {
                          vehicles.find(
                            (v) => v.id.toString() === selectedVehicleId,
                          )?.vehicle_number
                        }
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                    {/* Mobile Card View */}
                    <div className="block lg:hidden space-y-2">
                      {loading ? (
                        <LoadingSpinner
                          size="md"
                          centered
                          label="Loading records..."
                        />
                      ) : recordsError ? (
                        <ErrorState
                          title="Couldn’t load records"
                          description={recordsError}
                          onRetry={fetchRecords}
                        />
                      ) : records.length === 0 ? (
                        <EmptyState
                          icon={FuelIcon}
                          title="No Diesel Records"
                          description="No diesel entries recorded for this vehicle yet."
                          actionLabel="Add Diesel Entry"
                          onAction={() => setIsCreateOpen(true)}
                        />
                      ) : (
                        records.map((record) => {
                          const { date, time } = formatDate(record.fill_date);
                          return (
                            <div
                              key={record.id}
                              className="border rounded-lg p-2.5 space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm">
                                  {date}
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  {record.kml !== null &&
                                  record.kml !== undefined ? (
                                    <Badge
                                      variant="default"
                                      className={`text-xs ${
                                        record.expected_kml
                                          ? record.kml >= record.expected_kml
                                            ? "bg-green-600"
                                            : "bg-red-500"
                                          : "bg-muted text-foreground"
                                      }`}
                                    >
                                      {record.kml} Km/L
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-xs text-muted-foreground"
                                    >
                                      No mileage
                                    </Badge>
                                  )}
                                  <Badge
                                    variant={
                                      record.fill_type === "full"
                                        ? "info"
                                        : "secondary"
                                    }
                                    className="text-xs"
                                  >
                                    {record.fill_type === "full"
                                      ? "Full"
                                      : "Partial"}
                                  </Badge>
                                  <Badge
                                    variant={
                                      record.cycle_status === "closed"
                                        ? "success"
                                        : "warning"
                                    }
                                    className="text-xs"
                                  >
                                    {record.cycle_status === "closed"
                                      ? "● Closed"
                                      : "● Open"}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {time} · Driver: {record.driver_name}
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                <div>
                                  <span className="text-muted-foreground">
                                    Prev Odo:
                                  </span>{" "}
                                  {displayVal(record.prev_odo, " km")}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Curr Odo:
                                  </span>{" "}
                                  {record.current_odo} km
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Dist:
                                  </span>{" "}
                                  {displayVal(record.distance, " km")}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Fuel:
                                  </span>{" "}
                                  {record.fuel_litres}L
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    C.Dist:
                                  </span>{" "}
                                  {displayVal(record.cycle_distance, " km")}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    C.Fuel:
                                  </span>{" "}
                                  {displayVal(record.cycle_fuel, " L")}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Amount:
                                  </span>{" "}
                                  ₹{record.amount}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Exp:
                                  </span>{" "}
                                  {displayVal(record.expected_kml)}
                                </div>
                                <div
                                  className={
                                    record.dev_pct !== null &&
                                    record.dev_pct !== undefined
                                      ? record.dev_pct < 0
                                        ? "text-red-600 dark:text-red-400 font-medium"
                                        : "text-green-600 dark:text-green-400 font-medium"
                                      : ""
                                  }
                                >
                                  <span className="text-muted-foreground">
                                    Dev:
                                  </span>{" "}
                                  {displayVal(record.dev_pct, "%")}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    ₹/km:
                                  </span>{" "}
                                  {displayVal(record.cost_per_km)}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Station:
                                  </span>{" "}
                                  {record.station || "—"}
                                </div>
                              </div>
                              {(() => {
                                const warnings = getRecordWarnings(record);
                                if (warnings.length === 0) return null;
                                return (
                                  <div className="bg-amber-200 dark:bg-yellow-500 border border-yellow-500 dark:border-yellow-600 px-3 py-2 rounded-md space-y-1">
                                    {warnings.map((w, i) => (
                                      <div
                                        key={i}
                                        className="flex items-center gap-2 text-xs font-semibold text-black"
                                      >
                                        <AlertTriangleIcon
                                          size={14}
                                          className="shrink-0 text-black"
                                        />
                                        {w}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                              {userRole === "admin" && (
                                <div className="pt-1 flex justify-end gap-2">
                                  <Button
                                    data-testid={`admin-diesel-mobile-edit-${record.id}`}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-7 px-2"
                                    onClick={() => setEditTarget(record)}
                                  >
                                    <PencilIcon
                                      size={12}
                                      style={{ marginRight: "0.25rem" }}
                                    />{" "}
                                    Edit
                                  </Button>
                                  <Button
                                    data-testid={`admin-diesel-mobile-delete-${record.id}`}
                                    variant="destructive"
                                    size="sm"
                                    className="text-xs h-7 px-2"
                                    onClick={() => handleDeleteClick(record)}
                                  >
                                    <Trash2Icon
                                      size={12}
                                      style={{ marginRight: "0.25rem" }}
                                    />{" "}
                                    Delete
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden lg:block">
                      <DataTable<DieselRecordWithVehicle>
                        columns={[
                          {
                            key: "fill_date",
                            header: "Date & Time",
                            cell: (row) => {
                              const { date, time } = formatDate(row.fill_date);
                              return (
                                <div className="flex flex-col">
                                  <span className="whitespace-nowrap">{date}</span>
                                  <span className="text-xs text-muted-foreground">{time}</span>
                                </div>
                              );
                            },
                          },
                          {
                            key: "driver_name",
                            header: "Driver",
                            cell: (row) => row.driver_name,
                          },
                          {
                            key: "prev_odo",
                            header: "Prev Odo",
                            cell: (row) => displayVal(row.prev_odo),
                          },
                          {
                            key: "current_odo",
                            header: "Current Odo",
                            cell: (row) => row.current_odo,
                          },
                          {
                            key: "distance",
                            header: "Dist (km)",
                            cell: (row) => displayVal(row.distance),
                          },
                          {
                            key: "fuel_litres",
                            header: "Fuel (L)",
                            cell: (row) => row.fuel_litres,
                          },
                          {
                            key: "cycle_distance",
                            header: "Cycle Dist",
                            cell: (row) => displayVal(row.cycle_distance),
                            className: "text-muted-foreground",
                          },
                          {
                            key: "cycle_fuel",
                            header: "Cycle Fuel",
                            cell: (row) => displayVal(row.cycle_fuel),
                            className: "text-muted-foreground",
                          },
                          {
                            key: "kml",
                            header: "Mileage (Km/L)",
                            cell: (row) => (
                              <span
                                className={`font-bold ${
                                  row.kml !== null && row.kml !== undefined
                                    ? row.expected_kml
                                      ? row.kml >= row.expected_kml
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-red-600 dark:text-red-400"
                                      : ""
                                    : ""
                                }`}
                              >
                                {displayVal(row.kml)}
                              </span>
                            ),
                          },
                          {
                            key: "expected_kml",
                            header: "Avg Mileage",
                            cell: (row) => displayVal(row.expected_kml),
                          },
                          {
                            key: "dev_pct",
                            header: "Dev %",
                            cell: (row) => (
                              <span
                                className={
                                  row.dev_pct !== null && row.dev_pct !== undefined
                                    ? row.dev_pct < 0
                                      ? "text-red-600 dark:text-red-400 font-medium"
                                      : "text-green-600 dark:text-green-400 font-medium"
                                    : ""
                                }
                              >
                                {displayVal(row.dev_pct, "%")}
                              </span>
                            ),
                          },
                          {
                            key: "fill_type",
                            header: "Fill Type",
                            cell: (row) => (
                              <Badge
                                variant={row.fill_type === "full" ? "info" : "secondary"}
                                className="text-xs"
                              >
                                {row.fill_type === "full" ? "Full" : "Partial"}
                              </Badge>
                            ),
                          },
                          {
                            key: "cycle_status",
                            header: "Cycle",
                            cell: (row) => (
                              <Badge
                                variant={row.cycle_status === "closed" ? "success" : "warning"}
                                className="text-xs whitespace-nowrap"
                              >
                                {row.cycle_status === "closed" ? "● Closed" : "● Open"}
                              </Badge>
                            ),
                          },
                          {
                            key: "cycle_id",
                            header: "Cycle ID",
                            cell: (row) => row.cycle_id,
                          },
                          {
                            key: "price_per_l",
                            header: "Price/L",
                            cell: (row) => (row.price_per_l ? `₹${row.price_per_l}` : "—"),
                          },
                          {
                            key: "amount",
                            header: "Amount (₹)",
                            cell: (row) => `₹${row.amount}`,
                          },
                          {
                            key: "cost_per_km",
                            header: "Cost/km",
                            cell: (row) => (row.cost_per_km !== null && row.cost_per_km !== undefined ? `₹${row.cost_per_km}` : "—"),
                          },
                          {
                            key: "station",
                            header: "Station",
                            cell: (row) => row.station || "—",
                          },
                          {
                            key: "payment_method",
                            header: "Payment",
                            cell: (row) => row.payment_method || "—",
                          },
                          {
                            key: "receipt_number",
                            header: "Receipt",
                            cell: (row) => row.receipt_number || "—",
                          },
                          {
                            key: "verified_by",
                            header: "Verified",
                            cell: (row) => row.verified_by || "—",
                          },
                          {
                            key: "alerts",
                            header: "Alerts",
                            cell: (row) => {
                              const warnings = getRecordWarnings(row);
                              if (warnings.length === 0) return "—";
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 cursor-pointer">
                                      <AlertTriangleIcon size={16} className="text-amber-600 dark:text-amber-400" />
                                      <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold whitespace-nowrap">
                                        {warnings.length} issue
                                        {warnings.length > 1 ? "s" : ""}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="left"
                                    className="max-w-xs bg-amber-950 text-amber-100 border-amber-800"
                                  >
                                    <div className="space-y-1 py-1">
                                      {warnings.map((w, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs">
                                          <AlertTriangleIcon size={14} className="shrink-0 mt-0.5 text-amber-400" />
                                          {w}
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            },
                          },
                        ]}
                        data={records}
                        rowKey={(row) => row.id.toString()}
                        loading={loading}
                        emptyNode={
                          <EmptyState
                            icon={FuelIcon}
                            title="No Diesel Records"
                            description="No diesel entries recorded for this vehicle yet."
                            actionLabel="Add Diesel Entry"
                            onAction={() => setIsCreateOpen(true)}
                          />
                        }
                        rowActions={[
                          {
                            key: "edit",
                            label: "Edit",
                            icon: <PencilIcon size={14} />,
                            onClick: (row) => setEditTarget(row),
                            hidden: () => userRole !== "admin",
                          },
                          {
                            key: "delete",
                            label: "Delete",
                            icon: <Trash2Icon size={14} />,
                            variant: "danger",
                            onClick: (row) => handleDeleteClick(row),
                            hidden: () => userRole !== "admin",
                          },
                        ]}
                      />
                    </div>

                    {/* Pagination */}
                    {totalRecords > 0 && (
                      <div className="border-t border-border pt-2">
                        <Pagination
                          page={page}
                          totalCount={totalRecords}
                          pageSize={pageSize}
                          pageSizeOptions={[10, 20, 50, 100]}
                          onPageChange={handlePageChange}
                          onPageSizeChange={handlePageSizeChange}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
          </>
        )}

        <CreateDieselModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={fetchRecords}
          vehicles={vehicles}
          defaultVehicleId={selectedVehicleId || undefined}
        />

        <EditDieselModal
          record={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={fetchRecords}
        />

        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete Diesel Record"
          description="Are you sure? This action cannot be undone."
          confirmText="Delete"
          isLoading={isDeleting}
          error={deleteError}
        >
          {deleteTarget && (
            <div className="text-sm bg-muted/50 p-3 rounded-md w-full text-left space-y-1">
              <p>
                <span className="text-muted-foreground">Date:</span>{" "}
                {formatDate(deleteTarget.fill_date).date}
              </p>
              <p>
                <span className="text-muted-foreground">Driver:</span>{" "}
                {deleteTarget.driver_name}
              </p>
              <p>
                <span className="text-muted-foreground">Odo:</span>{" "}
                {deleteTarget.current_odo} km ·{" "}
                <span className="text-muted-foreground">Fuel:</span>{" "}
                {deleteTarget.fuel_litres}L
              </p>
            </div>
          )}
        </ConfirmModal>
      </div>
    </TooltipProvider>
  );
}
