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
import { ChevronLeftIcon, SaveIcon } from "@/components/ui/icon";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function NewTripSheetPage() {
  const [formData, setFormData] = useState({
    vehicle: "",
    driver: "",
    client: "",
  });

  const handleValueChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto px-4 py-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex items-center gap-3 md:gap-4">
        <Button data-testid="app-admin-trip-sheets-new-button-1" variant="ghost" size="icon" asChild className="max-md:hidden">
          <Link data-testid="app-admin-trip-sheets-new-link-1" href="/admin/trip-sheets" aria-label="Back to trip sheets">
            <ChevronLeftIcon size={16} />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            New Trip Sheet
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Create a new trip assignment for a vehicle and driver.
          </p>
        </div>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card data-testid="app-admin-trip-sheets-new-card-1">
          <CardHeader>
            <CardTitle>Trip Details</CardTitle>
            <CardDescription>
              Enter the details for the new trip.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input data-testid="app-admin-trip-sheets-new-input-1" id="date" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input data-testid="app-admin-trip-sheets-new-input-2" id="time" type="time" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle</Label>
              <Select data-testid="app-admin-trip-sheets-new-select-1"
                value={formData.vehicle}
                onValueChange={(value) => handleValueChange("vehicle", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AP02AB1234">
                    AP 02 AB 1234 (Bus)
                  </SelectItem>
                  <SelectItem value="AP02CD5678">
                    AP 02 CD 5678 (Car)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver">Driver</Label>
              <Select data-testid="app-admin-trip-sheets-new-select-2"
                value={formData.driver}
                onValueChange={(value) => handleValueChange("driver", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ramesh">Ramesh Kumar</SelectItem>
                  <SelectItem value="suresh">Suresh Babu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Client / Company</Label>
              <Select data-testid="app-admin-trip-sheets-new-select-3"
                value={formData.client}
                onValueChange={(value) => handleValueChange("client", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kia">KIA Motors (Main Plant)</SelectItem>
                  <SelectItem value="mobis">Mobis India</SelectItem>
                  <SelectItem value="sungwoo">Sungwoo Hitech</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-loc">Start Location</Label>
                <Input data-testid="app-admin-trip-sheets-new-input-3" id="start-loc" placeholder="e.g. Anantapur" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-loc">End Location</Label>
                <Input data-testid="app-admin-trip-sheets-new-input-4" id="end-loc" placeholder="e.g. KIA Plant" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Instructions</Label>
              <Textarea
                id="notes"
                placeholder="Any specific instructions for the driver..."
              />
            </div>

            <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
              <Button data-testid="app-admin-trip-sheets-new-button-2" variant="outline" className="w-full sm:w-auto" asChild>
                <Link data-testid="app-admin-trip-sheets-new-link-2" href="/admin/trip-sheets">Cancel</Link>
              </Button>
              <Button data-testid="app-admin-trip-sheets-new-button-3" className="w-full sm:w-auto">
                <SaveIcon size={16} style={{ marginRight: "0.5rem" }} /> Save Trip Sheet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
