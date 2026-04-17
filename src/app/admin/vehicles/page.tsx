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
import {
  Plus,
  Search,
  Truck,
  Car,
  Bus,
  Save,
  Van,
  FolderOpen,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
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
import { Vehicle } from "./vehicles.types";
import {
  getDefaultVehicleFormData,
  getStatusBadgeVariant,
} from "./vehicles.utils";
import {
  CA_VEHICLES_CONTAINER,
  CA_VEHICLES_HEADER_TITLE,
  CA_VEHICLES_HEADER_DESC,
  CA_MODAL_GRID,
  CA_MODAL_LABEL_SPACE,
} from "./vehicles.styles";
import { DocumentModal } from "@/components/documentModal";
import { Skeleton } from "@/components/skeletonLoader";
import dynamic from "next/dynamic";

const CreateVehicleModal = dynamic(
  () => import("@/components/createVehicleModal/createVehicleModal"),
  { ssr: false }
);

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await fetch("/api/vehicles");
        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();
        setVehicles(data as Vehicle[]);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
  }, []);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editFormData, setEditFormData] = useState<Omit<Vehicle, "id">>(
    getDefaultVehicleFormData(),
  );

  // Document Modal State
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [docVehicle, setDocVehicle] = useState<Vehicle | null>(null);

  // Delete Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Function to actively reload logic easily
  const fetchVehiclesRefetch = async () => {
    try {
      const res = await fetch("/api/vehicles");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setVehicles(data as Vehicle[]);
    } catch (error) {
      console.error("Error refetching vehicles:", error);
    }
  };

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

  const handleUpdateVehicle = async () => {
    if (!editingVehicle) return;

    try {
      const res = await fetch("/api/vehicles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingVehicle.id, ...editFormData }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Error updating vehicle:", errorData);
        alert(`Failed to update vehicle: ${errorData.error || res.statusText}`);
        return;
      }

      // Update local state to reflect changes without a full refetch if you want,
      // or simply fetch again. We'll update local state for speed.
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === editingVehicle.id ? { ...v, ...editFormData } : v,
        ),
      );

      setIsEditOpen(false);
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("Unexpected error updating vehicle.");
    }
  };

  const handleDeleteClick = (vehicle: Vehicle) => {
    setDeletingVehicle(vehicle);
    setIsDeleteOpen(true);
  };

  const handleDeleteVehicle = async () => {
    if (!deletingVehicle) return;

    try {
      const res = await fetch(`/api/vehicles?id=${deletingVehicle.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Error deleting vehicle:", errorData);
        alert(`Failed to delete vehicle: ${errorData.error || res.statusText}`);
        return;
      }

      // Remove vehicle from local state
      setVehicles((prev) => prev.filter((v) => v.id !== deletingVehicle.id));

      setIsDeleteOpen(false);
      setDeletingVehicle(null);
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("Unexpected error deleting vehicle.");
    }
  };

  return (
    <div className={CA_VEHICLES_CONTAINER}>
      <Button 
          variant="ghost" 
          onClick={() => router.back()} 
          className="mb-2 w-fit -ml-2 text-muted-foreground hover:text-foreground"
      >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
      </Button>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={CA_VEHICLES_HEADER_TITLE}>Vehicles</h1>
          <p className={CA_VEHICLES_HEADER_DESC}>
            Manage your fleet of buses, cars, and trucks.
          </p>
        </div>
        <Button className="w-full md:w-auto" onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Vehicle
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Total Fleet
            </CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">
              {loading ? <Skeleton width="40px" height="28px" borderRadius="4px" /> : vehicles.length}
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
              {loading ? <Skeleton width="40px" height="28px" borderRadius="4px" /> : vehicles.filter((v) => v.status === "Active").length}
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
              {loading ? <Skeleton width="40px" height="28px" borderRadius="4px" /> : vehicles.filter((v) => v.status === "Maintenance").length}
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
              {loading ? <Skeleton width="40px" height="28px" borderRadius="4px" /> : vehicles.filter((v) => v.status === "Idle").length}
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
            <CardTitle className="text-lg md:text-xl">Vehicle List</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search vehicles..." className="pl-8" />
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
            ) : vehicles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No vehicles found. Add one to get started.
              </p>
            ) : (
              vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">
                      {vehicle.vehicle_number}
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
                      <Bus className="h-3.5 w-3.5" />
                    ) : vehicle.vehicle_type === "Car" ? (
                      <Car className="h-3.5 w-3.5" />
                    ) : vehicle.vehicle_type === "Tempo Traveller" ||
                      vehicle.vehicle_type === "Tempo" ? (
                      <Van className="h-3.5 w-3.5" />
                    ) : (
                      <Truck className="h-3.5 w-3.5" />
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
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => {
                        setDocVehicle(vehicle);
                        setIsDocOpen(true);
                      }}
                    >
                      <FolderOpen className="mr-1 h-3.5 w-3.5" /> Docs
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => handleEditClick(vehicle)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs h-8 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(vehicle);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
                  <TableHead>Vehicle No.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Service</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : vehicles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      No vehicles found. Add one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  vehicles.map((vehicle) => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-medium">
                        {vehicle.vehicle_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {vehicle.vehicle_type === "Bus" ? (
                            <Bus className="h-4 w-4 text-muted-foreground" />
                          ) : vehicle.vehicle_type === "Car" ? (
                            <Car className="h-4 w-4 text-muted-foreground" />
                          ) : vehicle.vehicle_type === "Tempo Traveller" ||
                            vehicle.vehicle_type === "Tempo" ? (
                            <Van className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Truck className="h-4 w-4 text-muted-foreground" />
                          )}
                          {vehicle.vehicle_type}
                        </div>
                      </TableCell>
                      <TableCell>
                        {vehicle.company} {vehicle.model}
                      </TableCell>
                      <TableCell>{vehicle.capacity}</TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
                        {vehicle.last_service_date || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setDocVehicle(vehicle);
                            setIsDocOpen(true);
                          }}
                        >
                          <FolderOpen className="mr-2 h-4 w-4" /> Manage Docs
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(vehicle)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteClick(vehicle)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Vehicle Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] max-w-175 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vehicle</DialogTitle>
            <DialogDescription>
              Make changes to the vehicle details here. Click save when
              you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className={CA_MODAL_GRID}>
              <div className={CA_MODAL_LABEL_SPACE}>
                <Label htmlFor="vehicle_number">Vehicle Number</Label>
                <Input
                  id="vehicle_number"
                  value={editFormData.vehicle_number}
                  onChange={handleEditChange}
                />
              </div>
              <div className={CA_MODAL_LABEL_SPACE}>
                <Label htmlFor="vehicle_type">Vehicle Type</Label>
                <Select
                  value={editFormData.vehicle_type}
                  onValueChange={(value) =>
                    handleEditSelectChange("vehicle_type", value)
                  }
                >
                  <SelectTrigger>
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
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleUpdateVehicle}>
              <Save className="mr-2 h-4 w-4" /> Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="rounded-full bg-red-100 p-3">
              <Trash2 className="h-6 w-6 text-red-600" />
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
              >
                Delete Vehicle
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Management Modal */}
      <DocumentModal
        isOpen={isDocOpen}
        onClose={() => setIsDocOpen(false)}
        vehicle={docVehicle}
        onUpdate={fetchVehiclesRefetch}
      />

      {/* Create Vehicle Modal */}
      <CreateVehicleModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchVehiclesRefetch}
      />
    </div>
  );
}
