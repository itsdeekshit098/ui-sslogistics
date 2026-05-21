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
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeftIcon, SaveIcon, AlertTriangleIcon } from "@/components/ui/icon";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FillType, PaymentMethod } from "../dieselRecords.types";

interface VehicleOption {
  id: number;
  vehicle_number: string;
  company: string;
  model: string;
  expected_kml: number | null;
  tank_capacity: number | null;
}

export default function NewDieselRecordPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    time: new Date().toTimeString().split(" ")[0].substring(0, 5),
    vehicleId: "",
    driverName: "",
    fillType: "full" as FillType,
    fuelLitres: "",
    pricePerL: "",
    currentOdo: "",
    station: "",
    paymentMethod: "" as PaymentMethod | "",
    receiptNumber: "",
    notes: "",
  });

  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Fetch vehicles from API
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await fetch("/api/vehicles");
        if (res.ok) {
          const json = await res.json();
          setVehicles(json.data?.data ?? []);
        }
      } catch {
        // non-fatal
      } finally {
        setLoadingVehicles(false);
      }
    };
    fetchVehicles();
  }, []);

  // Client-side warnings
  const selectedVehicle = vehicles.find(
    (v) => v.id.toString() === formData.vehicleId,
  );

  const checkWarnings = useCallback(() => {
    const w: string[] = [];
    const litres = parseFloat(formData.fuelLitres);
    const tank = selectedVehicle?.tank_capacity;

    if (tank && litres > tank) {
      w.push(`Fuel (${litres}L) exceeds tank capacity (${tank}L)`);
    }
    if (
      formData.fillType === "full" &&
      tank &&
      litres < tank * 0.3 &&
      litres > 0
    ) {
      w.push(
        `Only ${litres}L for a full fill? Tank capacity is ${tank}L. Are you sure this is a full fill?`,
      );
    }
    setWarnings(w);
  }, [formData.fuelLitres, formData.fillType, selectedVehicle?.tank_capacity]);

  useEffect(() => {
    checkWarnings();
  }, [checkWarnings]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    // Client validations
    if (
      !formData.vehicleId ||
      !formData.driverName ||
      !formData.fuelLitres ||
      !formData.pricePerL ||
      !formData.currentOdo
    ) {
      setError("Please fill all mandatory fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fillDate = new Date(
        `${formData.date}T${formData.time}:00`,
      ).toISOString();

      const payload = {
        vehicle_id: parseInt(formData.vehicleId),
        driver_name: formData.driverName,
        fill_date: fillDate,
        fill_type: formData.fillType,
        fuel_litres: parseFloat(formData.fuelLitres),
        price_per_l: parseFloat(formData.pricePerL),
        current_odo: parseFloat(formData.currentOdo),
        station: formData.station || undefined,
        payment_method: formData.paymentMethod || undefined,
        receipt_number: formData.receiptNumber || undefined,
        notes: formData.notes || undefined,
      };

      const response = await fetch("/api/diesel-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        router.push("/admin/diesel-records");
      } else {
        setError(data.error || "Failed to save record");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex items-center gap-3 md:gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/diesel-records">
            <ChevronLeftIcon size={16} />
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
        {/* Error Banner */}
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm border border-destructive/20">
            {error}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-4 py-3 rounded-md space-y-1">
            {warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200"
              >
                <AlertTriangleIcon size={16} className="shrink-0" />
                {w}
              </div>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Fuel Details</CardTitle>
            <CardDescription>Enter the fuel filling details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time *</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Vehicle */}
            <div className="space-y-2">
              <Label htmlFor="vehicleId">Vehicle *</Label>
              <Select
                value={formData.vehicleId}
                onValueChange={(v) => {
                  setFormData((prev) => ({ ...prev, vehicleId: v }));
                  setError(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingVehicles ? "Loading vehicles..." : "Select Vehicle"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.vehicle_number} — {v.company} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedVehicle && (
                <p className="text-xs text-muted-foreground">
                  Tank: {selectedVehicle.tank_capacity ?? "—"}L · Exp Km/L:{" "}
                  {selectedVehicle.expected_kml ?? "—"}
                </p>
              )}
            </div>

            {/* Driver */}
            <div className="space-y-2">
              <Label htmlFor="driverName">Driver Name *</Label>
              <Input
                id="driverName"
                placeholder="Driver Name"
                value={formData.driverName}
                onChange={handleChange}
              />
            </div>

            {/* Fill Type */}
            <div className="space-y-2">
              <Label>Fill Type *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.fillType === "full" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, fillType: "full" }))
                  }
                >
                  Full Fill
                </Button>
                <Button
                  type="button"
                  variant={
                    formData.fillType === "partial" ? "default" : "outline"
                  }
                  className="flex-1"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, fillType: "partial" }))
                  }
                >
                  Partial Fill
                </Button>
              </div>
            </div>

            {/* Fuel & Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fuelLitres">Fuel Added (Litres) *</Label>
                <Input
                  id="fuelLitres"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={formData.fuelLitres}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pricePerL">Price per L (₹) *</Label>
                <Input
                  id="pricePerL"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={formData.pricePerL}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Computed Amount */}
            {formData.fuelLitres && formData.pricePerL && (
              <div className="bg-muted/50 p-3 rounded-md text-sm">
                Amount:{" "}
                <span className="font-semibold">
                  ₹
                  {(
                    parseFloat(formData.fuelLitres) *
                    parseFloat(formData.pricePerL)
                  ).toFixed(2)}
                </span>
              </div>
            )}

            {/* Odometer & Station */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentOdo">Current Odometer (km) *</Label>
                <Input
                  id="currentOdo"
                  type="number"
                  placeholder="0"
                  min="0"
                  value={formData.currentOdo}
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

            {/* Payment & Receipt */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      paymentMethod: v as PaymentMethod,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Fleet">Fleet Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiptNumber">Receipt Number</Label>
                <Input
                  id="receiptNumber"
                  placeholder="Receipt / Bill No."
                  value={formData.receiptNumber}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={formData.notes}
                onChange={handleChange}
                rows={2}
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
                {loading ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <SaveIcon size={16} style={{ marginRight: "0.5rem" }} />
                )}
                {loading ? "Saving..." : "Save Record"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
