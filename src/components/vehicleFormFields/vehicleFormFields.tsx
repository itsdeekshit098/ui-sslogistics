"use client";

import React from "react";
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
import {
  VEHICLE_TYPES,
  TRUCK_TYPES,
  CONTAINER_LENGTHS,
  AXLE_TYPES,
  CONTAINER_BODY_TYPES,
  FUEL_TYPES,
  OWNER_TYPES,
} from "@/app/admin/vehicles/vehicles.types";
import { hasSeatingCapacity } from "@/app/admin/vehicles/vehicles.utils";
import {
  CA_MODAL_GRID,
  CA_MODAL_LABEL_SPACE,
} from "@/app/admin/vehicles/vehicles.styles";
import { VehicleFormFieldsProps } from "./vehicleFormFields.types";

const errorInputClass = (hasError?: string) =>
  hasError ? "border-destructive focus-visible:ring-destructive" : "";
const errorTriggerClass = (hasError?: string) =>
  hasError ? "border-destructive focus:ring-destructive" : "";

/**
 * Pure presentational field set for the vehicle form — no fetch calls, no
 * validation logic. Rendered identically by CreateVehicleModal and
 * EditVehicleModal; all state lives in `useVehicleForm`.
 */
export const VehicleFormFields: React.FC<VehicleFormFieldsProps> = ({
  formData,
  errors,
  disabled,
  owners,
  onChange,
  onSelectChange,
  onVehicleTypeChange,
  onOwnerTypeChange,
  onNumberChange,
  onAddOwnerClick,
  testIdPrefix,
}) => {
  const isTruck = formData.vehicle_type === "TRUCK";
  const isContainer = formData.vehicle_type === "CONTAINER";
  const showSeatingCapacity = hasSeatingCapacity(formData.vehicle_type);
  const ownersForType = owners.filter(
    (o) => o.owner_type === formData.owner_type,
  );

  return (
    <div className="space-y-4">
      {/* Row: Owner Type + Owner Name */}
      <div className={CA_MODAL_GRID}>
        <div className={CA_MODAL_LABEL_SPACE}>
          <Label htmlFor="owner_type">
            Owner Type <span className="text-destructive">*</span>
          </Label>
          <Select
            disabled={disabled}
            data-testid={`${testIdPrefix}-select-owner-type`}
            value={formData.owner_type ?? ""}
            onValueChange={onOwnerTypeChange}
          >
            <SelectTrigger className={errorTriggerClass(errors.owner_type)}>
              <SelectValue placeholder="Select Owner Type" />
            </SelectTrigger>
            <SelectContent>
              {OWNER_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.owner_type && (
            <p className="text-xs text-destructive mt-1">{errors.owner_type}</p>
          )}
        </div>
        <div className={CA_MODAL_LABEL_SPACE}>
          <Label htmlFor="owner_name">
            Owner Name <span className="text-destructive">*</span>
          </Label>
          <Select
            disabled={disabled || !formData.owner_type}
            data-testid={`${testIdPrefix}-select-owner-name`}
            value={formData.owner_name ?? ""}
            onValueChange={(val) => onSelectChange("owner_name", val)}
          >
            <SelectTrigger className={errorTriggerClass(errors.owner_name)}>
              <SelectValue
                placeholder={
                  formData.owner_type
                    ? "Select Owner Name"
                    : "Select Owner Type first"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {ownersForType.map((o) => (
                <SelectItem key={o.id} value={o.name}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.owner_name && (
            <p className="text-xs text-destructive mt-1">{errors.owner_name}</p>
          )}
          {formData.owner_type && (
            <Button
              type="button"
              variant="link"
              size="sm"
              data-testid={`${testIdPrefix}-button-add-owner`}
              disabled={disabled}
              onClick={onAddOwnerClick}
              className="text-xs h-auto p-0 justify-start w-fit"
            >
              + Add New Owner
            </Button>
          )}
        </div>
      </div>

      {/* Row 1: Vehicle Number + Vehicle Type */}
      <div className={CA_MODAL_GRID}>
        <div className={CA_MODAL_LABEL_SPACE}>
          <Label htmlFor="vehicle_number">
            Vehicle Number <span className="text-destructive">*</span>
          </Label>
          <Input
            disabled={disabled}
            data-testid={`${testIdPrefix}-input-vehicle-number`}
            id="vehicle_number"
            placeholder="AP 02 AB 1234"
            value={formData.vehicle_number}
            onChange={onChange}
            className={errorInputClass(errors.vehicle_number)}
          />
          {errors.vehicle_number && (
            <p className="text-xs text-destructive mt-1">
              {errors.vehicle_number}
            </p>
          )}
        </div>
        <div className={CA_MODAL_LABEL_SPACE}>
          <Label htmlFor="vehicle_type">
            Vehicle Type <span className="text-destructive">*</span>
          </Label>
          <Select
            disabled={disabled}
            data-testid={`${testIdPrefix}-select-vehicle-type`}
            value={formData.vehicle_type}
            onValueChange={onVehicleTypeChange}
          >
            <SelectTrigger className={errorTriggerClass(errors.vehicle_type)}>
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.vehicle_type && (
            <p className="text-xs text-destructive mt-1">{errors.vehicle_type}</p>
          )}
        </div>
      </div>

      {/* Truck Sub-fields */}
      {isTruck && (
        <div className={CA_MODAL_LABEL_SPACE}>
          <Label htmlFor="truck_type">
            Truck Type <span className="text-destructive">*</span>
          </Label>
          <Select
            disabled={disabled}
            data-testid={`${testIdPrefix}-select-truck-type`}
            value={formData.truck_type ?? ""}
            onValueChange={(val) => onSelectChange("truck_type", val)}
          >
            <SelectTrigger className={errorTriggerClass(errors.truck_type)}>
              <SelectValue placeholder="Select Truck Type" />
            </SelectTrigger>
            <SelectContent>
              {TRUCK_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.truck_type && (
            <p className="text-xs text-destructive mt-1">{errors.truck_type}</p>
          )}
        </div>
      )}

      {/* Container Sub-fields */}
      {isContainer && (
        <>
          <div className={CA_MODAL_GRID}>
            <div className={CA_MODAL_LABEL_SPACE}>
              <Label htmlFor="container_length">
                Container Length <span className="text-destructive">*</span>
              </Label>
              <Select
                disabled={disabled}
                data-testid={`${testIdPrefix}-select-container-length`}
                value={formData.container_length ?? ""}
                onValueChange={(val) =>
                  onSelectChange("container_length", val)
                }
              >
                <SelectTrigger
                  className={errorTriggerClass(errors.container_length)}
                >
                  <SelectValue placeholder="Select Length" />
                </SelectTrigger>
                <SelectContent>
                  {CONTAINER_LENGTHS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.container_length && (
                <p className="text-xs text-destructive mt-1">
                  {errors.container_length}
                </p>
              )}
            </div>
            <div className={CA_MODAL_LABEL_SPACE}>
              <Label htmlFor="axle_type">
                Axle Type <span className="text-destructive">*</span>
              </Label>
              <Select
                disabled={disabled}
                data-testid={`${testIdPrefix}-select-axle-type`}
                value={formData.axle_type ?? ""}
                onValueChange={(val) => onSelectChange("axle_type", val)}
              >
                <SelectTrigger className={errorTriggerClass(errors.axle_type)}>
                  <SelectValue placeholder="Select Axle Type" />
                </SelectTrigger>
                <SelectContent>
                  {AXLE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.axle_type && (
                <p className="text-xs text-destructive mt-1">
                  {errors.axle_type}
                </p>
              )}
            </div>
          </div>
          <div className={CA_MODAL_LABEL_SPACE}>
            <Label htmlFor="container_body_type">
              Body Type <span className="text-destructive">*</span>
            </Label>
            <Select
              disabled={disabled}
              data-testid={`${testIdPrefix}-select-container-body-type`}
              value={formData.container_body_type ?? ""}
              onValueChange={(val) =>
                onSelectChange("container_body_type", val)
              }
            >
              <SelectTrigger
                className={errorTriggerClass(errors.container_body_type)}
              >
                <SelectValue placeholder="Select Body Type" />
              </SelectTrigger>
              <SelectContent>
                {CONTAINER_BODY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.container_body_type && (
              <p className="text-xs text-destructive mt-1">
                {errors.container_body_type}
              </p>
            )}
          </div>
        </>
      )}

      {/* Row: Company + Model */}
      <div className={CA_MODAL_GRID}>
        <div className={CA_MODAL_LABEL_SPACE}>
          <Label htmlFor="company">Company</Label>
          <Input
            disabled={disabled}
            data-testid={`${testIdPrefix}-input-company`}
            id="company"
            placeholder="e.g. Tata"
            value={formData.company}
            onChange={onChange}
          />
        </div>
        <div className={CA_MODAL_LABEL_SPACE}>
          <Label htmlFor="model">Model</Label>
          <Input
            disabled={disabled}
            data-testid={`${testIdPrefix}-input-model`}
            id="model"
            placeholder="e.g. Starbus"
            value={formData.model}
            onChange={onChange}
          />
        </div>
      </div>

      {/* Seating Capacity — only for Car / Bus / Tempo Traveller */}
      {showSeatingCapacity && (
        <div className={CA_MODAL_GRID}>
          <div className={CA_MODAL_LABEL_SPACE}>
            <Label htmlFor="seating_capacity">
              Seating Capacity <span className="text-destructive">*</span>
            </Label>
            <Input
              disabled={disabled}
              data-testid={`${testIdPrefix}-input-seating-capacity`}
              id="seating_capacity"
              type="number"
              placeholder="e.g. 40"
              min="1"
              value={formData.seating_capacity?.toString() ?? ""}
              onChange={(e) =>
                onNumberChange("seating_capacity", e.target.value)
              }
              onWheel={(e) => e.currentTarget.blur()}
              className={errorInputClass(errors.seating_capacity)}
            />
            {errors.seating_capacity && (
              <p className="text-xs text-destructive mt-1">
                {errors.seating_capacity}
              </p>
            )}
          </div>
          <div className={CA_MODAL_LABEL_SPACE}>
            <Label htmlFor="last_service_date">Last Service Date</Label>
            <Input
              disabled={disabled}
              data-testid={`${testIdPrefix}-input-last-service-date`}
              id="last_service_date"
              type="date"
              value={formData.last_service_date || ""}
              onChange={onChange}
            />
          </div>
        </div>
      )}

      {/* Last Service Date — standalone row when no seating capacity */}
      {!showSeatingCapacity && formData.vehicle_type !== "" && (
        <div className={CA_MODAL_GRID}>
          <div className={CA_MODAL_LABEL_SPACE}>
            <Label htmlFor="last_service_date">Last Service Date</Label>
            <Input
              disabled={disabled}
              data-testid={`${testIdPrefix}-input-last-service-date-standalone`}
              id="last_service_date"
              type="date"
              value={formData.last_service_date || ""}
              onChange={onChange}
            />
          </div>
        </div>
      )}

      {/* Row: Status + Fuel Type */}
      <div className={CA_MODAL_GRID}>
        <div className={CA_MODAL_LABEL_SPACE}>
          <Label htmlFor="status">Status</Label>
          <Select
            disabled={disabled}
            data-testid={`${testIdPrefix}-select-status`}
            value={formData.status}
            onValueChange={(val) => onSelectChange("status", val)}
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
        <div className={CA_MODAL_LABEL_SPACE}>
          <Label htmlFor="fuel_type">Fuel Type</Label>
          <Select
            disabled={disabled}
            data-testid={`${testIdPrefix}-select-fuel-type`}
            value={formData.fuel_type || "DIESEL"}
            onValueChange={(val) => onSelectChange("fuel_type", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Fuel Type" />
            </SelectTrigger>
            <SelectContent>
              {FUEL_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row: Expected Km/L + Tank Capacity */}
      <div className={CA_MODAL_GRID}>
        <div className={CA_MODAL_LABEL_SPACE}>
          <Label htmlFor="expected_kml">Expected Km/L</Label>
          <Input
            disabled={disabled}
            data-testid={`${testIdPrefix}-input-expected-kml`}
            id="expected_kml"
            type="number"
            placeholder="e.g. 4.5"
            step="0.01"
            min="0"
            value={formData.expected_kml ?? ""}
            onChange={(e) =>
              onNumberChange("expected_kml", e.target.value, true)
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
        </div>
        <div className={CA_MODAL_LABEL_SPACE}>
          <Label htmlFor="tank_capacity">Tank Capacity (L)</Label>
          <Input
            disabled={disabled}
            data-testid={`${testIdPrefix}-input-tank-capacity`}
            id="tank_capacity"
            type="number"
            placeholder="e.g. 200"
            step="0.01"
            min="0"
            value={formData.tank_capacity ?? ""}
            onChange={(e) =>
              onNumberChange("tank_capacity", e.target.value, true)
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
        </div>
      </div>
    </div>
  );
};

export default VehicleFormFields;
