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
import { ChevronLeft, Save } from "lucide-react";
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
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/trip-sheets">
            <ChevronLeft className="h-4 w-4" />
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
        <Card>
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
                <Input id="date" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input id="time" type="time" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle</Label>
              <Select
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
              <Select
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
              <Select
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
                <Input id="start-loc" placeholder="e.g. Anantapur" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-loc">End Location</Label>
                <Input id="end-loc" placeholder="e.g. KIA Plant" />
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
              <Button variant="outline" className="w-full sm:w-auto" asChild>
                <Link href="/admin/trip-sheets">Cancel</Link>
              </Button>
              <Button className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" /> Save Trip Sheet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
