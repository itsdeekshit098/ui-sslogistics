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
import { Plus, Search, User, Phone, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Driver {
  id: string;
  name: string;
  license: string;
  phone: string;
  assignedVehicle: string;
  status: string;
}

const mockDrivers: Driver[] = [
  {
    id: "D-001",
    name: "Ramesh Kumar",
    license: "AP02 2018001234",
    phone: "+91 98765 43210",
    assignedVehicle: "AP 02 AB 1234",
    status: "Active",
  },
  {
    id: "D-002",
    name: "Suresh Babu",
    license: "AP02 2019005678",
    phone: "+91 98765 12345",
    assignedVehicle: "AP 02 CD 5678",
    status: "Active",
  },
  {
    id: "D-003",
    name: "Mahesh V",
    license: "AP02 2020009012",
    phone: "+91 98765 67890",
    assignedVehicle: "Unassigned",
    status: "On Leave",
  },
];

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>(mockDrivers);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    license: "",
    phone: "",
    assignedVehicle: "",
    status: "",
  });

  const handleEditClick = (driver: Driver) => {
    setEditingDriver(driver);
    setEditFormData({
      name: driver.name,
      license: driver.license,
      phone: driver.phone,
      assignedVehicle: driver.assignedVehicle,
      status: driver.status,
    });
    setIsEditOpen(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleEditSelectChange = (field: string, value: string) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleUpdateDriver = () => {
    setDrivers((prev) =>
      prev.map((d) =>
        editingDriver && d.id === editingDriver.id
          ? { ...d, ...editFormData }
          : d,
      ),
    );
    setIsEditOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Drivers
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage driver profiles and vehicle assignments.
          </p>
        </div>
        <Button className="w-full md:w-auto" asChild>
          <Link href="/admin/drivers/new">
            <Plus className="mr-2 h-4 w-4" /> Add Driver
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Total Drivers
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">
              {drivers.length}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Registered drivers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              On Duty
            </CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">
              {drivers.filter((d) => d.status === "Active").length}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Currently driving
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              On Leave
            </CardTitle>
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">
              {drivers.filter((d) => d.status === "On Leave").length}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Unavailable today
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg md:text-xl">Driver List</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search drivers..." className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {drivers.map((driver) => (
              <div key={driver.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{driver.name}</span>
                  <Badge
                    variant={
                      driver.status === "Active" ? "default" : "secondary"
                    }
                  >
                    {driver.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    <span>{driver.phone}</span>
                  </div>
                  <div>License: {driver.license}</div>
                  <div>Vehicle: {driver.assignedVehicle}</div>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleEditClick(driver)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver Name</TableHead>
                  <TableHead>License No.</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Assigned Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell>{driver.license}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {driver.phone}
                      </div>
                    </TableCell>
                    <TableCell>{driver.assignedVehicle}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          driver.status === "Active" ? "default" : "secondary"
                        }
                      >
                        {driver.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(driver)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Driver</DialogTitle>
            <DialogDescription>
              Make changes to the driver&apos;s profile here. Click save when
              you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={editFormData.name}
                onChange={handleEditChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="license" className="text-right">
                License
              </Label>
              <Input
                id="license"
                value={editFormData.license}
                onChange={handleEditChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone
              </Label>
              <Input
                id="phone"
                value={editFormData.phone}
                onChange={handleEditChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="assignedVehicle" className="text-right">
                Vehicle
              </Label>
              <Input
                id="assignedVehicle"
                value={editFormData.assignedVehicle}
                onChange={handleEditChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) =>
                  handleEditSelectChange("status", value)
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="On Leave">On Leave</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleUpdateDriver}>
              <Save className="mr-2 h-4 w-4" />
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
