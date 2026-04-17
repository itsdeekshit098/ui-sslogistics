"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Save } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDefaultVehicleFormData } from "../vehicles.utils";

export default function NewVehiclePage() {
  const router = useRouter();
  const [formData, setFormData] = useState(getDefaultVehicleFormData());
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // We no longer need to nullify explicitly on client,
      // but it's safe to pass clean JSON here. The backend does it too.
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push("/admin/vehicles");
        router.refresh();
      } else {
        const errorData = await response.json();
        console.error("Failed to save vehicle", errorData);
        alert(
          `Failed to save vehicle: ${errorData.error || response.statusText}`,
        );
      }
    } catch (error: unknown) {
      console.error("Error saving vehicle:", error);
      alert(
        `Error saving vehicle: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex items-center gap-3 md:gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/vehicles">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Add New Vehicle
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Register a new vehicle to the fleet.
          </p>
        </div>
      </div>

      <div className="grid gap-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Details</CardTitle>
            <CardDescription>
              Enter the registration, specification and document links.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle_number">Vehicle Number</Label>
                <Input
                  id="vehicle_number"
                  placeholder="AP 02 AB 1234"
                  value={formData.vehicle_number}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_type">Vehicle Type</Label>
                <Select
                  value={formData.vehicle_type}
                  onValueChange={(val) =>
                    handleSelectChange("vehicle_type", val)
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="e.g. Tata"
                  value={formData.company}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="e.g. Starbus"
                  value={formData.model}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Seating / Load Capacity</Label>
                <Input
                  id="capacity"
                  placeholder="e.g. 40 Seater"
                  value={formData.capacity}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_service_date">Last Service Date</Label>
                <Input
                  id="last_service_date"
                  type="date"
                  value={formData.last_service_date || ""}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Initial Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => handleSelectChange("status", val)}
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

            <div className="bg-muted/50 p-4 rounded-md text-sm text-muted-foreground mt-6">
              <strong>Note:</strong> You will be able to securely upload PDF and
              Image documents (RC, FC, Insurance, etc.) to Supabase Storage by
              clicking &quot;Manage Docs&quot; on the main vehicle table after
              successfully creating this vehicle entry.
            </div>

            <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/admin/vehicles">Cancel</Link>
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <Save className="mr-2 h-4 w-4" />{" "}
                {loading ? "Saving..." : "Save Vehicle"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
