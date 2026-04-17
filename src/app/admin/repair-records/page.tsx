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
import { Plus, Search, Zap, Settings } from "lucide-react";
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

// Mock data for repair records
interface RepairRecord {
  id: number;
  vehicleId: number;
  date: string;
  category: string;
  issues: string[];
  description: string;
  cost: number;
  status: string;
  technician: string;
}

const mockRepairRecords: RepairRecord[] = [
  {
    id: 1,
    vehicleId: 1,
    date: "2024-03-15",
    category: "electrical",
    issues: ["Battery", "Lights"],
    description: "Replaced battery and fixed tail light wiring",
    cost: 4500,
    status: "Completed",
    technician: "Raju",
  },
  {
    id: 2,
    vehicleId: 1,
    date: "2024-02-10",
    category: "mechanical",
    issues: ["Brakes", "Oil Service"],
    description: "Regular service and brake pad replacement",
    cost: 8000,
    status: "Completed",
    technician: "Krishna",
  },
  {
    id: 3,
    vehicleId: 2,
    date: "2024-03-18",
    category: "mechanical",
    issues: ["Tyres"],
    description: "Replaced front two tyres",
    cost: 12000,
    status: "Pending",
    technician: "Vendor",
  },
];

export default function RepairRecordsPage() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [records, setRecords] = useState<RepairRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (selectedVehicleId) {
      // Simulate fetch
      timeoutId = setTimeout(() => {
        setRecords(
          mockRepairRecords.filter(
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
            Repair Records
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            View and manage vehicle repair history.
          </p>
        </div>
        <Button className="w-full md:w-auto" asChild>
          <Link href="/admin/repair-records/new">
            <Plus className="mr-2 h-4 w-4" /> Add Repair Record
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
                Repair History for{" "}
                {
                  mockVehicles.find(
                    (v) => v.id.toString() === selectedVehicleId,
                  )?.vehicle_number
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
            <div className="block md:hidden space-y-3">
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
                          record.status === "Completed" ? "default" : "outline"
                        }
                        className={
                          record.status === "Completed"
                            ? "bg-green-600 hover:bg-green-700"
                            : "text-yellow-600 border-yellow-600"
                        }
                      >
                        {record.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground capitalize">
                      {record.category === "electrical" ? (
                        <Zap className="h-3.5 w-3.5 text-yellow-500" />
                      ) : (
                        <Settings className="h-3.5 w-3.5 text-slate-500" />
                      )}
                      {record.category}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {record.issues.map((issue: string) => (
                        <Badge
                          key={issue}
                          variant="secondary"
                          className="text-xs"
                        >
                          {issue}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div>
                        Cost: ₹{record.cost.toLocaleString()} • Tech:{" "}
                        {record.technician}
                      </div>
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
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        No records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.date}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 capitalize">
                            {record.category === "electrical" ? (
                              <Zap className="h-4 w-4 text-yellow-500" />
                            ) : (
                              <Settings className="h-4 w-4 text-slate-500" />
                            )}
                            {record.category}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {record.issues.map((issue: string) => (
                              <Badge
                                key={issue}
                                variant="secondary"
                                className="text-xs"
                              >
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell
                          className="max-w-xs truncate"
                          title={record.description}
                        >
                          {record.description}
                        </TableCell>
                        <TableCell>₹{record.cost.toLocaleString()}</TableCell>
                        <TableCell>{record.technician}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              record.status === "Completed"
                                ? "default"
                                : "outline"
                            }
                            className={
                              record.status === "Completed"
                                ? "bg-green-600 hover:bg-green-700"
                                : "text-yellow-600 border-yellow-600"
                            }
                          >
                            {record.status}
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
