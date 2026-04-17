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

export default function NewClientPage() {
  const [formData, setFormData] = useState({
    type: "vendor",
  });

  const handleValueChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto px-4 py-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex items-center gap-3 md:gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/clients">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Add New Client
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Register a new company or vendor.
          </p>
        </div>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>Enter the company information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input id="name" placeholder="e.g. Mobis India Pvt Ltd" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Company Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => handleValueChange("type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Company Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendor">Vendor / Sub-company</SelectItem>
                  <SelectItem value="primary">Primary (KIA)</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location / Address</Label>
              <Input id="location" placeholder="Industrial Park, Penukonda" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-person">Contact Person</Label>
                <Input id="contact-person" placeholder="Name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Contact Phone</Label>
                <Input id="phone" placeholder="+91..." />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contracts">Active Contracts</Label>
              <Input
                id="contracts"
                placeholder="e.g. Employee Transport, Logistics"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="Additional details..." />
            </div>

            <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
              <Button variant="outline" className="w-full sm:w-auto" asChild>
                <Link href="/admin/clients">Cancel</Link>
              </Button>
              <Button className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" /> Save Client
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
