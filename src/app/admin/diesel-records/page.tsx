"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, AlertTriangle, ArrowLeft } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreateDieselModal } from "@/components/createDieselModal";
import { EditDieselModal } from "@/components/editDieselModal";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { Pagination } from "@/components/pagination";
import { createClient } from "@/utils/supabase/client";
import type { DieselRecordWithVehicle } from "./dieselRecords.types";
import { RefreshCw, Fuel } from "lucide-react";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";

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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<DieselRecordWithVehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<DieselRecordWithVehicle | null>(
    null,
  );
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(
    Number(searchParams.get("pageSize")) || 10,
  );
  const [totalRecords, setTotalRecords] = useState(0);

  // Fetch user role on mount
  useEffect(() => {
    const fetchRole = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserRole(user?.app_metadata?.role || null);
    };
    fetchRole();
  }, []);

  // Fetch vehicles
  const fetchVehicles = useCallback(async () => {
    setVehiclesLoading(true);
    setVehiclesError(null);
    try {
      const res = await fetch("/api/vehicles");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
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
        const result = await res.json();
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
    try {
      const res = await fetch(`/api/diesel-records?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        fetchRecords();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete record");
      }
    } catch {
      alert("Network error deleting record");
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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="container mx-auto px-3 py-3 md:p-6 space-y-4 md:space-y-8">
        <Button
          data-testid="diesel-back-btn"
          variant="ghost"
          onClick={() => router.back()}
          className="mb-2 w-fit -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
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
          {(userRole === "admin" || userRole === "driver") && (
            <Button
              data-testid="admin-diesel-add-btn"
              className="w-full md:w-auto"
              onClick={() => setIsCreateOpen(true)}
              disabled={vehiclesLoading || !!vehiclesError}
            >
              {vehiclesLoading ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {vehiclesLoading ? "Loading Vehicles..." : "Add Diesel Entry"}
            </Button>
          )}
        </div>

        {userRole === "admin" && (
          <>
            <div className="flex items-center gap-4">
              <Select
                value={selectedVehicleId}
                onValueChange={handleVehicleChange}
                disabled={vehiclesLoading}
              >
                <SelectTrigger className="w-full sm:w-[280px]">
                  {vehiclesLoading ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <LoadingSpinner size="sm" /> Loading vehicles...
                    </span>
                  ) : (
                    <SelectValue placeholder="Select Vehicle" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.vehicle_number} — {v.company} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {vehiclesError && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchVehicles}
                  className="shrink-0"
                >
                  <RefreshCw className="h-4 w-4 mr-1" /> Retry
                </Button>
              )}
            </div>
            {vehiclesError && !vehiclesLoading && (
              <ErrorState
                title="Couldn’t load vehicles"
                description={vehiclesError}
                onRetry={fetchVehicles}
              />
            )}

            {!vehiclesLoading && !vehiclesError && !selectedVehicleId && (
              <EmptyState
                icon={Fuel}
                title="Select a Vehicle"
                description="Choose a vehicle from the dropdown above to view its diesel records."
              />
            )}

            {userRole === "admin" && selectedVehicleId && (
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
                        icon={Fuel}
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
                                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-black" />
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
                                  <Pencil className="h-3 w-3 mr-1" /> Edit
                                </Button>
                                <Button
                                  data-testid={`admin-diesel-mobile-delete-${record.id}`}
                                  variant="destructive"
                                  size="sm"
                                  className="text-xs h-7 px-2"
                                  onClick={() => handleDeleteClick(record)}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Driver</TableHead>
                          <TableHead>Prev Odo</TableHead>
                          <TableHead>Current Odo</TableHead>
                          <TableHead>Dist (km)</TableHead>
                          <TableHead>Fuel (L)</TableHead>
                          <TableHead>Cycle Dist</TableHead>
                          <TableHead>Cycle Fuel</TableHead>
                          <TableHead className="font-bold">
                            Mileage (Km/L)
                          </TableHead>
                          <TableHead>Avg Mileage</TableHead>
                          <TableHead>Dev %</TableHead>
                          <TableHead>Fill Type</TableHead>
                          <TableHead>Cycle</TableHead>
                          <TableHead>Cycle ID</TableHead>
                          <TableHead>Price/L</TableHead>
                          <TableHead>Amount (₹)</TableHead>
                          <TableHead>Cost/km</TableHead>
                          <TableHead>Station</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead>Receipt</TableHead>
                          <TableHead>Verified</TableHead>
                          <TableHead>Alerts</TableHead>
                          {userRole === "admin" && (
                            <TableHead className="text-center">
                              Actions
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={userRole === "admin" ? 23 : 22}>
                              <LoadingSpinner
                                size="sm"
                                centered
                                label="Loading records..."
                              />
                            </TableCell>
                          </TableRow>
                        ) : recordsError ? (
                          <TableRow>
                            <TableCell colSpan={userRole === "admin" ? 23 : 22}>
                              <ErrorState
                                title="Couldn’t load records"
                                description={recordsError}
                                onRetry={fetchRecords}
                              />
                            </TableCell>
                          </TableRow>
                        ) : records.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={userRole === "admin" ? 23 : 22}>
                              <EmptyState
                                icon={Fuel}
                                title="No Diesel Records"
                                description="No diesel entries recorded for this vehicle yet."
                                actionLabel="Add Diesel Entry"
                                onAction={() => setIsCreateOpen(true)}
                              />
                            </TableCell>
                          </TableRow>
                        ) : (
                          records.map((record) => {
                            const { date, time } = formatDate(record.fill_date);
                            return (
                              <TableRow key={record.id}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="whitespace-nowrap">
                                      {date}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {time}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>{record.driver_name}</TableCell>
                                <TableCell>
                                  {displayVal(record.prev_odo)}
                                </TableCell>
                                <TableCell>{record.current_odo}</TableCell>
                                <TableCell>
                                  {displayVal(record.distance)}
                                </TableCell>
                                <TableCell>{record.fuel_litres}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {displayVal(record.cycle_distance)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {displayVal(record.cycle_fuel)}
                                </TableCell>
                                <TableCell
                                  className={`font-bold ${
                                    record.kml !== null &&
                                    record.kml !== undefined
                                      ? record.expected_kml
                                        ? record.kml >= record.expected_kml
                                          ? "text-green-600 dark:text-green-400"
                                          : "text-red-600 dark:text-red-400"
                                        : ""
                                      : ""
                                  }`}
                                >
                                  {displayVal(record.kml)}
                                </TableCell>
                                <TableCell>
                                  {displayVal(record.expected_kml)}
                                </TableCell>
                                <TableCell
                                  className={
                                    record.dev_pct !== null &&
                                    record.dev_pct !== undefined
                                      ? record.dev_pct < 0
                                        ? "text-red-600 dark:text-red-400 font-medium"
                                        : "text-green-600 dark:text-green-400 font-medium"
                                      : ""
                                  }
                                >
                                  {displayVal(record.dev_pct, "%")}
                                </TableCell>
                                <TableCell>
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
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      record.cycle_status === "closed"
                                        ? "success"
                                        : "warning"
                                    }
                                    className="text-xs whitespace-nowrap"
                                  >
                                    {record.cycle_status === "closed"
                                      ? "● Closed"
                                      : "● Open"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{record.cycle_id}</TableCell>
                                <TableCell>
                                  {record.price_per_l
                                    ? `₹${record.price_per_l}`
                                    : "—"}
                                </TableCell>
                                <TableCell>₹{record.amount}</TableCell>
                                <TableCell>
                                  {record.cost_per_km !== null &&
                                  record.cost_per_km !== undefined
                                    ? `₹${record.cost_per_km}`
                                    : "—"}
                                </TableCell>
                                <TableCell>{record.station || "—"}</TableCell>
                                <TableCell>
                                  {record.payment_method || "—"}
                                </TableCell>
                                <TableCell>
                                  {record.receipt_number || "—"}
                                </TableCell>
                                <TableCell>
                                  {record.verified_by || "—"}
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const warnings = getRecordWarnings(record);
                                    if (warnings.length === 0) return "—";
                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-1 cursor-pointer">
                                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
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
                                              <div
                                                key={i}
                                                className="flex items-start gap-2 text-xs"
                                              >
                                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                                                {w}
                                              </div>
                                            ))}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })()}
                                </TableCell>
                                {userRole === "admin" && (
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        data-testid={`admin-diesel-desktop-edit-${record.id}`}
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => setEditTarget(record)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        data-testid={`admin-diesel-desktop-delete-${record.id}`}
                                        variant="destructive"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() =>
                                          handleDeleteClick(record)
                                        }
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
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
        />

        <EditDieselModal
          record={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={fetchRecords}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <DialogContent className="max-w-md rounded-xl sm:rounded-2xl">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="rounded-full bg-red-100 p-3">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Delete Diesel Record</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Are you sure? This action cannot be undone.
                </p>
              </div>
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
              <div className="flex gap-3 w-full">
                <Button
                  data-testid="admin-diesel-delete-cancel-btn"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  data-testid="admin-diesel-delete-confirm-btn"
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                >
                  {isDeleting && <LoadingSpinner size="sm" className="mr-2" />}
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
