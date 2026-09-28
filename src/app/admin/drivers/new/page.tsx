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
import { ChevronLeftIcon, SaveIcon } from "@/components/ui/icon";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function NewDriverPage() {
  const [formData, setFormData] = useState({
    vehicle: "",
    status: "active",
  });

  const handleValueChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto px-4 py-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex items-center gap-3 md:gap-4">
        <Button data-testid="app-admin-drivers-new-button-1" variant="ghost" size="icon" asChild className="max-md:hidden">
          <Link data-testid="app-admin-drivers-new-link-1" href="/admin/drivers" aria-label="Back to drivers">
            <ChevronLeftIcon size={16} />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Add New Driver
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Register a new driver to the system.
          </p>
        </div>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card data-testid="app-admin-drivers-new-card-1">
          <CardHeader>
            <CardTitle>Driver Details</CardTitle>
            <CardDescription>
              Enter the personal and license details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input data-testid="app-admin-drivers-new-input-1" id="name" placeholder="e.g. Ramesh Kumar" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input data-testid="app-admin-drivers-new-input-2" id="phone" placeholder="+91 98765 43210" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="license">Driving License Number</Label>
              <Input data-testid="app-admin-drivers-new-input-3" id="license" placeholder="AP02 2018001234" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">License Expiry</Label>
                <Input data-testid="app-admin-drivers-new-input-4" id="expiry" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience">Experience (Years)</Label>
                <Input data-testid="app-admin-drivers-new-input-5" id="experience" type="number" placeholder="5" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle">Assign Vehicle (Optional)</Label>
              <Select data-testid="app-admin-drivers-new-select-1"
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
              <Label htmlFor="status">Status</Label>
              <Select data-testid="app-admin-drivers-new-select-2"
                value={formData.status}
                onValueChange={(value) => handleValueChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="leave">On Leave</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
              <Button data-testid="app-admin-drivers-new-button-2" variant="outline" className="w-full sm:w-auto" asChild>
                <Link data-testid="app-admin-drivers-new-link-2" href="/admin/drivers">Cancel</Link>
              </Button>
              <Button data-testid="app-admin-drivers-new-button-3" className="w-full sm:w-auto">
                <SaveIcon size={16} style={{ marginRight: "0.5rem" }} /> Save Driver
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
