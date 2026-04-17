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
import { ChevronLeft, Save, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { mockVehicles } from "@/lib/mock-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function NewDieselRecordPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    time: new Date().toTimeString().split(" ")[0].substring(0, 5),
    vehicleId: "",
    driver: "",
    currentOdometer: "",
    fuelAdded: "",
    pricePerL: "",
    station: "",
    billPhotoUrl: "", // Assuming text input for now as per plan
  });
  const [loading, setLoading] = useState(false);

  // Mock vehicles
  const vehicles = mockVehicles;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleVehicleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, vehicleId: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        date: formData.date,
        time: formData.time + ":00", // Append seconds
        vehicle: { id: parseInt(formData.vehicleId) },
        driver: formData.driver,
        currentOdometer: parseFloat(formData.currentOdometer),
        fuelAdded: formData.fuelAdded ? parseFloat(formData.fuelAdded) : 0,
        pricePerL: formData.pricePerL ? parseFloat(formData.pricePerL) : 0,
        station: formData.station,
        billPhotoUrl: formData.billPhotoUrl,
      };

      const response = await fetch("http://localhost:8080/api/diesel-records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.push("/admin/diesel-records");
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to save record", errorData);
        alert(`Failed to save record: ${errorData.error || response.statusText || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error saving record:", error);
      alert(`Error saving record: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex items-center gap-3 md:gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/diesel-records">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            New Diesel Entry
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Record fuel consumption for a vehicle.
          </p>
        </div>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Fuel Details</CardTitle>
            <CardDescription>Enter the fuel filling details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicleId">Vehicle</Label>
              <Select
                value={formData.vehicleId}
                onValueChange={handleVehicleChange}
              >
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="driver">Driver Name</Label>
              <Input
                id="driver"
                placeholder="Driver Name"
                value={formData.driver}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fuelAdded">Fuel Added (Litres)</Label>
                <Input
                  id="fuelAdded"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.fuelAdded}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pricePerL">Price per L (₹)</Label>
                <Input
                  id="pricePerL"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.pricePerL}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentOdometer">Current Odometer (km)</Label>
                <Input
                  id="currentOdometer"
                  type="number"
                  placeholder="0"
                  value={formData.currentOdometer}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="station">Fuel Station</Label>
                <Input
                  id="station"
                  placeholder="Station Name / Location"
                  value={formData.station}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billPhotoUrl">Bill / Receipt Photo URL</Label>
              <Input
                id="billPhotoUrl"
                placeholder="http://..."
                value={formData.billPhotoUrl}
                onChange={handleChange}
              />
            </div>

            <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
              <Button variant="outline" className="w-full sm:w-auto" asChild>
                <Link href="/admin/diesel-records">Cancel</Link>
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {loading ? "Saving..." : "Save Record"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
