"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CreateVehicleModalProps } from "./createVehicleModal.types";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDefaultVehicleFormData } from "@/app/admin/vehicles/vehicles.utils";
import {
  CA_MODAL_GRID,
  CA_MODAL_LABEL_SPACE,
} from "@/app/admin/vehicles/vehicles.styles";

/**
 * Inner form component that mounts/unmounts with modal visibility.
 * This ensures form state is naturally reset on each open — no useEffect needed.
 */
const CreateVehicleForm: React.FC<{
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState(getDefaultVehicleFormData());
  const [loading, setLoading] = useState(false);

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  // Handle escape key (disabled while submitting)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

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
    if (!formData.vehicle_number || !formData.vehicle_type) {
      alert("Please provide the vehicle number and type.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await onSuccess();
        setLoading(false);
        onClose();
      } else {
        const errorData = await response.json();
        console.error("Failed to save vehicle", errorData);
        alert(`Failed to save vehicle: ${errorData.error || response.statusText}`);
        setLoading(false);
      }
    } catch (error: unknown) {
      console.error("Error saving vehicle:", error);
      alert(
        `Error saving vehicle: ${error instanceof Error ? error.message : String(error)}`
      );
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
      {/* Click outside to close (desktop only, disabled while submitting) */}
      <div className="absolute inset-0 hidden sm:block" onClick={handleClose} />

      <div
        className="relative z-50 w-full bg-background flex flex-col shadow-xl animate-in slide-in-from-bottom h-[92vh] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl rounded-t-xl sm:rounded-lg sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-vehicle-title"
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-4 sm:px-6 rounded-t-xl sm:rounded-t-lg">
          <div>
            <h2 id="create-vehicle-title" className="text-lg font-semibold tracking-tight">Add New Vehicle</h2>
            <p className="text-sm text-muted-foreground hidden sm:block">Register a new vehicle to the fleet.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} disabled={loading} className="rounded-full">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="space-y-4">
            <div className={CA_MODAL_GRID}>
              <div className={CA_MODAL_LABEL_SPACE}>
                <Label htmlFor="vehicle_number">Vehicle Number <span className="text-red-500">*</span></Label>
                <Input
                  id="vehicle_number"
                  placeholder="AP 02 AB 1234"
                  value={formData.vehicle_number}
                  onChange={handleChange}
                />
              </div>
              <div className={CA_MODAL_LABEL_SPACE}>
                <Label htmlFor="vehicle_type">Vehicle Type <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.vehicle_type}
                  onValueChange={(val) => handleSelectChange("vehicle_type", val)}
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
                  placeholder="e.g. Tata"
                  value={formData.company}
                  onChange={handleChange}
                />
              </div>
              <div className={CA_MODAL_LABEL_SPACE}>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="e.g. Starbus"
                  value={formData.model}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className={CA_MODAL_GRID}>
              <div className={CA_MODAL_LABEL_SPACE}>
                <Label htmlFor="capacity">Seating / Load Capacity</Label>
                <Input
                  id="capacity"
                  placeholder="e.g. 40 Seater"
                  value={formData.capacity}
                  onChange={handleChange}
                />
              </div>
              <div className={CA_MODAL_LABEL_SPACE}>
                <Label htmlFor="last_service_date">Last Service Date</Label>
                <Input
                  id="last_service_date"
                  type="date"
                  value={formData.last_service_date || ""}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className={CA_MODAL_GRID}>
              <div className={CA_MODAL_LABEL_SPACE}>
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
          </div>

          <div className="bg-muted/50 p-4 rounded-md text-sm text-muted-foreground mt-2">
            <strong>Note:</strong> You will be able to securely upload PDF and Image documents (RC, FC, Insurance, etc.) to Supabase Storage by clicking &quot;Manage Docs&quot; on the main vehicle table after successfully creating this vehicle entry.
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 z-10 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 border-t bg-background px-4 py-4 sm:px-6 rounded-b-xl sm:rounded-b-lg">
          <Button variant="outline" onClick={handleClose} disabled={loading} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto">
            <Save className="mr-2 h-4 w-4" />{" "}
            {loading ? "Saving..." : "Save Vehicle"}
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Wrapper that conditionally mounts/unmounts the form.
 * This pattern avoids useEffect-based state resets entirely.
 */
const CreateVehicleModal: React.FC<CreateVehicleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  return <CreateVehicleForm onClose={onClose} onSuccess={onSuccess} />;
};

export default CreateVehicleModal;
