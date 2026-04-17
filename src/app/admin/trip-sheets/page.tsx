"use client";

import Link from "next/link";
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
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { mockVehicles } from "@/lib/mock-data";

interface TripSheet {
  id: string;
  date: string;
  vehicleId: number;
  vehicle: string;
  driver: string;
  client: string;
  status: string;
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
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [records, setRecords] = useState<TripSheet[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="container mx-auto px-4 py-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Trip Sheets
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage and track all vehicle trips and assignments.
          </p>
        </div>
        <Button className="w-full md:w-auto" asChild>
          <Link href="/admin/trip-sheets/new">
            <Plus className="mr-2 h-4 w-4" /> Create Trip Sheet
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select value={selectedVehicleId} onValueChange={handleVehicleChange}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="Select Vehicle" />
          </SelectTrigger>
          <SelectContent>
            {mockVehicles.map((v) => (
              <SelectItem key={v.id} value={v.id.toString()}>
                {v.vehicle_number} - {v.company} {v.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedVehicleId && (
        <Card>
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg md:text-xl">
                Trips for{" "}
                {
                  mockVehicles.find(
                    (v) => v.id.toString() === selectedVehicleId,
                  )?.vehicle_number
                }
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search trips..." className="pl-8" />
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
                      <Badge
                        variant={
                          trip.status === "Completed"
                            ? "default"
                            : trip.status === "In Progress"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {trip.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>Date: {trip.date}</div>
                      <div>Driver: {trip.driver}</div>
                      <div>Client: {trip.client}</div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" className="text-xs h-7">
                        View
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trip ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        No trips found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((trip) => (
                      <TableRow key={trip.id}>
                        <TableCell className="font-medium">{trip.id}</TableCell>
                        <TableCell>{trip.date}</TableCell>
                        <TableCell>{trip.driver}</TableCell>
                        <TableCell>{trip.client}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              trip.status === "Completed"
                                ? "default"
                                : trip.status === "In Progress"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {trip.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
