"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, SearchIcon, EyeIcon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/dataTable";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { useAuth } from "@/context/AuthContext";

interface MockVehicle {
  id: number;
  vehicle_number: string;
  company?: string;
  model?: string;
}

interface TripSheet {
  id: string;
  date: string;
  vehicleId: number;
  vehicle: string;
  driver: string;
  client: string;
  status: string;
}

function getTripStatusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Completed") return "default";
  if (status === "In Progress") return "secondary";
  return "outline";
}

const mockTripSheets: TripSheet[] = [
  {
    id: "TS-2024-001",
    date: "2024-01-08",
    vehicleId: 1,
    vehicle: "AP 02 AB 1234",
    driver: "Ramesh Kumar",
    client: "KIA Motors (Main Plant)",
    status: "Completed",
  },
  {
    id: "TS-2024-002",
    date: "2024-01-08",
    vehicleId: 2,
    vehicle: "AP 02 CD 5678",
    driver: "Suresh Babu",
    client: "Mobis India",
    status: "In Progress",
  },
  {
    id: "TS-2024-003",
    date: "2024-01-09",
    vehicleId: 3,
    vehicle: "AP 02 EF 9012",
    driver: "Mahesh V",
    client: "Sungwoo Hitech",
    status: "Scheduled",
  },
];

export default function TripSheetsPage() {
  const { loading: authLoading } = useAuth();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [records, setRecords] = useState<TripSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<MockVehicle[]>([]);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await fetch("/api/vehicles");
        if (res.ok) {
          const json = await res.json();
          setVehicles(json.data?.data ?? []);
        }
      } catch {
        /* non-fatal */
      }
    };
    fetchVehicles();
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (selectedVehicleId) {
      // Simulate fetch
      timeoutId = setTimeout(() => {
        setRecords(
          mockTripSheets.filter(
            (r) => r.vehicleId.toString() === selectedVehicleId,
          ),
        );
        setLoading(false);
      }, 500);
    } else {
      timeoutId = setTimeout(() => {
        setRecords([]);
        setLoading(false);
      }, 0);
    }
    return () => clearTimeout(timeoutId);
  }, [selectedVehicleId]);

  const handleVehicleChange = (id: string) => {
    setLoading(true);
    setSelectedVehicleId(id);
  };

  if (authLoading) return <PageLoadingSkeleton variant="admin" />;

  return (
    <div className="container mx-auto md:p-6 space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* The mobile top bar already names the page. */}
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight max-md:hidden">
            Trip Sheets
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage and track all vehicle trips and assignments.
          </p>
        </div>
        <Button
          data-testid="app-admin-trip-sheets-button-1"
          className="w-full md:w-auto"
          asChild
        >
          <Link
            data-testid="app-admin-trip-sheets-link-1"
            href="/admin/trip-sheets/new"
          >
            <PlusIcon size={16} style={{ marginRight: "0.5rem" }} /> Create Trip Sheet
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select
          data-testid="app-admin-trip-sheets-select-1"
          value={selectedVehicleId}
          onValueChange={handleVehicleChange}
        >
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="Select Vehicle" />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id.toString()}>
                {v.vehicle_number} - {v.company} {v.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedVehicleId && (
        <Card data-testid="app-admin-trip-sheets-card-1">
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg md:text-xl">
                Trips for{" "}
                {
                  vehicles.find((v) => v.id.toString() === selectedVehicleId)
                    ?.vehicle_number
                }
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <SearchIcon size={16} className="absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  data-testid="app-admin-trip-sheets-input-1"
                  placeholder="Search trips..."
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">
                  Loading...
                </p>
              ) : records.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No trips found.
                </p>
              ) : (
                records.map((trip) => (
                  <div
                    key={trip.id}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{trip.id}</span>
                      <Badge variant={getTripStatusVariant(trip.status)}>
                        {trip.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>Date: {trip.date}</div>
                      <div>Driver: {trip.driver}</div>
                      <div>Client: {trip.client}</div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        data-testid="app-admin-trip-sheets-button-2"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        disabled
                        title="Coming soon"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              <DataTable<TripSheet>
                columns={[
                  {
                    key: "id",
                    header: "Trip ID",
                    cell: (row) => <span className="font-medium">{row.id}</span>,
                  },
                  {
                    key: "date",
                    header: "Date",
                    cell: (row) => row.date,
                  },
                  {
                    key: "driver",
                    header: "Driver",
                    cell: (row) => row.driver,
                  },
                  {
                    key: "client",
                    header: "Client",
                    cell: (row) => row.client,
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (row) => (
                      <Badge variant={getTripStatusVariant(row.status)}>
                        {row.status}
                      </Badge>
                    ),
                  },
                ]}
                data={records}
                rowKey={(row) => row.id}
                loading={loading}
                emptyNode={
                  <p className="text-center text-muted-foreground py-8">
                    No trips found.
                  </p>
                }
                rowActions={[
                  {
                    key: "view",
                    label: "View",
                    icon: <EyeIcon size={14} />,
                    onClick: () => {},
                    disabled: () => true,
                    disabledTooltip: "Coming soon",
                  },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

