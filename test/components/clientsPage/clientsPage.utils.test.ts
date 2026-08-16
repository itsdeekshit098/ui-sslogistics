import { describe, it, expect } from "vitest";
import {
  getVehicleTypeLabel,
  describeDeployment,
  describeFleetMix,
  balanceTone,
} from "@/components/clientsPage/clientsPage.utils";
import type { ClientDeployment } from "@/components/clientsPage/clientsPage.types";

function deployment(overrides: Partial<ClientDeployment>): ClientDeployment {
  return {
    id: 1,
    client_id: 1,
    vehicle_id: null,
    quantity: 1,
    vehicle_type: "TRUCK",
    seating_capacity: null,
    truck_type: null,
    container_length: null,
    axle_type: null,
    container_body_type: null,
    monthly_rate: null,
    start_date: null,
    end_date: null,
    is_active: true,
    notes: null,
    ...overrides,
  };
}

describe("getVehicleTypeLabel", () => {
  it("resolves a known enum value to its display label", () => {
    expect(getVehicleTypeLabel("BUS")).toBe("Bus");
    expect(getVehicleTypeLabel("CONTAINER")).toBe("Container");
  });

  it("falls back to the raw value for an unrecognized type", () => {
    expect(getVehicleTypeLabel("SPACESHIP")).toBe("SPACESHIP");
  });
});

describe("describeDeployment", () => {
  it("describes a bus deployment by seating capacity", () => {
    expect(
      describeDeployment(
        deployment({ vehicle_type: "BUS", seating_capacity: 43 }),
      ),
    ).toBe("Bus · 43-seater");
  });

  it("describes a container deployment by length and body type", () => {
    expect(
      describeDeployment(
        deployment({
          vehicle_type: "CONTAINER",
          container_length: "32_FT",
          container_body_type: "CLOSED",
        }),
      ),
    ).toBe("Container · 32 ft · Closed Container");
  });

  it("describes a truck deployment by truck type and axle", () => {
    expect(
      describeDeployment(
        deployment({
          vehicle_type: "TRUCK",
          truck_type: "HCV",
          axle_type: "MULTI_AXLE",
        }),
      ),
    ).toBe("Truck · Heavy Commercial Vehicle (HCV) · Multi Axle (MXL)");
  });

  it("omits sub-fields that are null rather than printing empty segments", () => {
    expect(describeDeployment(deployment({ vehicle_type: "CAR" }))).toBe(
      "Car",
    );
  });
});

describe("describeFleetMix", () => {
  it("formats counts largest-first, separated by middle dots", () => {
    expect(
      describeFleetMix({ TRUCK: 2, BUS: 4, CONTAINER: 0 }),
    ).toBe("4 × Bus · 2 × Truck");
  });

  it("drops zero-count entries entirely", () => {
    expect(describeFleetMix({ TRUCK: 0, BUS: 0 })).toBe("");
  });

  it("returns an empty string for an empty mix", () => {
    expect(describeFleetMix({})).toBe("");
  });
});

describe("balanceTone", () => {
  it("labels a positive advance as Advance, even with outstanding also positive", () => {
    expect(balanceTone(500, 200)).toEqual({ label: "Advance", tone: "advance" });
  });

  it("labels positive outstanding with no advance as Outstanding", () => {
    expect(balanceTone(500, 0)).toEqual({ label: "Outstanding", tone: "owed" });
  });

  it("labels zero/zero as Settled rather than a confusing minus sign", () => {
    expect(balanceTone(0, 0)).toEqual({ label: "Settled", tone: "clear" });
  });
});
