import { describe, it, expect } from "vitest";
import { vehicleLabel } from "@/lib/vehicleLabel";

describe("vehicleLabel", () => {
  it("joins company and model after the vehicle number", () => {
    expect(
      vehicleLabel({ vehicle_number: "KA428059", company: "EICHER", model: "PRO 2110" }),
    ).toBe("KA428059 — EICHER PRO 2110");
  });

  it("omits a missing company", () => {
    expect(
      vehicleLabel({ vehicle_number: "KA428059", company: null, model: "PRO 2110" }),
    ).toBe("KA428059 — PRO 2110");
  });

  it("omits a missing model", () => {
    expect(
      vehicleLabel({ vehicle_number: "KA428059", company: "EICHER", model: null }),
    ).toBe("KA428059 — EICHER");
  });

  it("returns only the vehicle number when both are missing", () => {
    expect(
      vehicleLabel({ vehicle_number: "KA428059", company: null, model: null }),
    ).toBe("KA428059");
  });

  it("returns only the vehicle number when company/model are undefined", () => {
    expect(vehicleLabel({ vehicle_number: "KA428059" })).toBe("KA428059");
  });

  it("treats an empty string the same as missing", () => {
    expect(
      vehicleLabel({ vehicle_number: "KA428059", company: "", model: "" }),
    ).toBe("KA428059");
  });
});
