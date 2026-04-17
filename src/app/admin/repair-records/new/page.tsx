"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Settings, Save, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { mockVehicles } from "@/lib/mock-data";

type RepairCategory = "electrical" | "mechanical" | null;

const repairOptions = {
  electrical: [
    "Battery",
    "Lights",
    "Self Motor",
    "Alternator",
    "Wiring",
    "Fuses",
    "Horn",
    "Indicators",
  ],
  mechanical: [
    "Engine",
    "Brakes",
    "Clutch",
    "Suspension",
    "Gearbox",
    "Tyres",
    "Oil Service",
    "Coolant System",
  ],
};

export default function NewRepairRecordPage() {
  const router = useRouter();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] =
    useState<RepairCategory>(null);
  const [selectedSubOptions, setSelectedSubOptions] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");

  const handleVehicleChange = (value: string) => {
    setSelectedVehicleId(value);
    // Reset other states when vehicle changes
    setSelectedCategory(null);
    setSelectedSubOptions([]);
    setDescription("");
    setCost("");
  };

  const toggleSubOption = (option: string) => {
    if (selectedSubOptions.includes(option)) {
      setSelectedSubOptions(
        selectedSubOptions.filter((item) => item !== option),
      );
    } else {
      setSelectedSubOptions([...selectedSubOptions, option]);
    }
  };

  const handleSubmit = () => {
    // Here you would typically send the data to the backend
    console.log({
      vehicleId: selectedVehicleId,
      category: selectedCategory,
      subOptions: selectedSubOptions,
      description,
      cost,
    });
    alert("Repair record saved successfully!");
    router.push("/admin/repair-records");
  };

  return (
    <div className="container mx-auto px-4 py-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex items-center gap-3 md:gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/repair-records">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            New Repair Record
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Create a new repair entry for a vehicle.
          </p>
        </div>
      </div>

      {/* Vehicle Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Vehicle</CardTitle>
          <CardDescription>
            Choose the vehicle undergoing repair
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedVehicleId} onValueChange={handleVehicleChange}>
            <SelectTrigger className="w-full md:w-[300px]">
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
        </CardContent>
      </Card>

      {selectedVehicleId && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Repair Category Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                selectedCategory === "electrical"
                  ? "border-primary ring-1 ring-primary"
                  : "",
              )}
              onClick={() => setSelectedCategory("electrical")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold">
                  Electrical Work
                </CardTitle>
                <Zap className="h-6 w-6 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Battery, lights, wiring, alternator, etc.
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                selectedCategory === "mechanical"
                  ? "border-primary ring-1 ring-primary"
                  : "",
              )}
              onClick={() => setSelectedCategory("mechanical")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold">
                  Mechanical Work
                </CardTitle>
                <Settings className="h-6 w-6 text-slate-500" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Engine, brakes, suspension, gearbox, etc.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sub Options & Details */}
          {selectedCategory && (
            <Card className="animate-in fade-in zoom-in-95 duration-300">
              <CardHeader>
                <CardTitle className="capitalize">
                  {selectedCategory} Repair Details
                </CardTitle>
                <CardDescription>
                  Select specific issues and add details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Sub Options Grid */}
                <div className="space-y-3">
                  <Label>Specific Issues</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {repairOptions[selectedCategory].map((option) => (
                      <div
                        key={option}
                        className={cn(
                          "flex items-center justify-center p-3 rounded-md border text-sm font-medium cursor-pointer transition-colors",
                          selectedSubOptions.includes(option)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted",
                        )}
                        onClick={() => toggleSubOption(option)}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Details */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cost">Estimated Cost (₹)</Label>
                    <Input
                      id="cost"
                      placeholder="0.00"
                      type="number"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description / Notes</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the work done or parts replaced..."
                      className="min-h-[100px]"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    size="lg"
                    onClick={handleSubmit}
                    disabled={selectedSubOptions.length === 0}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Record
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
