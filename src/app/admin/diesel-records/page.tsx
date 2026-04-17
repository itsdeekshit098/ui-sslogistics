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
import { Plus, Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { mockDieselRecords } from "@/lib/mock-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { mockVehicles } from "@/lib/mock-data";

interface DieselRecord {
  id: number;
  vehicle: { id: number };
  date: string;
  time: string;
  driver: string;
  currentOdometer: number;
  previousOdometer: number;
  distance: number;
  fuelAdded: number;
  pricePerL: number;
  amount: number;
  consumption: string;
  expectedKmL: string;
  deviation: number;
  station: string;
  verifiedBy: string;
  billPhotoUrl: string;
  discrepancy: boolean;
}

export default function DieselRecordsPage() {
  // Mock data for development
  const vehicles = mockVehicles;

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [records, setRecords] = useState<DieselRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (selectedVehicleId) {
      // Simulate fetch
      timeoutId = setTimeout(() => {
        setRecords(
          mockDieselRecords.filter(
            (r) => r.vehicle.id.toString() === selectedVehicleId,
          ) as unknown as DieselRecord[],
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
            Diesel Records
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Track fuel consumption and mileage for all vehicles.
          </p>
        </div>
        <Button className="w-full md:w-auto" asChild>
          <Link href="/admin/diesel-records/new">
            <Plus className="mr-2 h-4 w-4" /> Add Diesel Entry
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select value={selectedVehicleId} onValueChange={handleVehicleChange}>
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
        <Card>
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg md:text-xl">
                Records for{" "}
                {
                  vehicles.find((v) => v.id.toString() === selectedVehicleId)
                    ?.vehicle_number
                }
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search records..." className="pl-8" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">
                  Loading...
                </p>
              ) : records.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No records found.
                </p>
              ) : (
                records.map((record) => (
                  <div
                    key={record.id}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {record.date}
                      </span>
                      <Badge
                        variant={
                          !record.discrepancy ? "outline" : "destructive"
                        }
                      >
                        {!record.discrepancy ? "Normal" : "Discrepancy"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {record.time} • Driver: {record.driver}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">Fuel:</span>{" "}
                        {record.fuelAdded}L
                      </div>
                      <div>
                        <span className="text-muted-foreground">Amount:</span> ₹
                        {record.amount}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Odo:</span>{" "}
                        {record.currentOdometer} km
                      </div>
                      <div>
                        <span className="text-muted-foreground">Km/L:</span>{" "}
                        {record.consumption}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Station:</span>{" "}
                        {record.station}
                      </div>
                      <div
                        className={
                          record.deviation < 0
                            ? "text-red-500"
                            : "text-green-500"
                        }
                      >
                        <span className="text-muted-foreground">Dev:</span>{" "}
                        {record.deviation}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Odometer (km)</TableHead>
                    <TableHead>Fuel (L)</TableHead>
                    <TableHead>Price/L</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Prev Odo</TableHead>
                    <TableHead>Dist (km)</TableHead>
                    <TableHead>Km/L</TableHead>
                    <TableHead>Exp Km/L</TableHead>
                    <TableHead>Dev %</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Verified By</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center">
                        No records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{record.date}</span>
                            <span className="text-xs text-muted-foreground">
                              {record.time}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{record.driver}</TableCell>
                        <TableCell>{record.currentOdometer}</TableCell>
                        <TableCell>{record.fuelAdded}</TableCell>
                        <TableCell>₹{record.pricePerL}</TableCell>
                        <TableCell>₹{record.amount}</TableCell>
                        <TableCell>{record.previousOdometer}</TableCell>
                        <TableCell>{record.distance}</TableCell>
                        <TableCell>{record.consumption}</TableCell>
                        <TableCell>{record.expectedKmL}</TableCell>
                        <TableCell
                          className={
                            record.deviation < 0
                              ? "text-red-500"
                              : "text-green-500"
                          }
                        >
                          {record.deviation}%
                        </TableCell>
                        <TableCell>{record.station}</TableCell>
                        <TableCell>{record.verifiedBy}</TableCell>
                        <TableCell>
                          {record.billPhotoUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <a
                                href={record.billPhotoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              !record.discrepancy ? "outline" : "destructive"
                            }
                          >
                            {!record.discrepancy ? "Normal" : "Discrepancy"}
                          </Badge>
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
