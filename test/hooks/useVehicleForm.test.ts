// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVehicleForm } from "@/hooks/useVehicleForm";
import { Vehicle } from "@/app/admin/vehicles/vehicles.types";

function baseVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    vehicle_number: "KA01AB1234",
    vehicle_type: "TRUCK",
    seating_capacity: null,
    company: "SS",
    model: "X",
    status: "Active",
    last_service_date: "",
    truck_type: "OPEN",
    container_length: null,
    axle_type: null,
    container_body_type: null,
    rc_url: "",
    insurance_url: "",
    fc_url: "",
    permit_url: "",
    pollution_url: "",
    tax_url: "",
    expected_kml: null,
    tank_capacity: null,
    fuel_type: "DIESEL",
    owner_type: "COMPANY",
    owner_name: "Owner",
    ...overrides,
  } as Vehicle;
}

describe("useVehicleForm", () => {
  it("seeds blank form data in create mode", () => {
    const { result } = renderHook(() =>
      useVehicleForm({ onSubmit: vi.fn(), onSuccess: vi.fn() }),
    );
    expect(result.current.formData.vehicle_number).toBe("");
  });

  it("seeds from an existing vehicle, dropping id", () => {
    const vehicle = baseVehicle();
    const { result } = renderHook(() =>
      useVehicleForm({ initialVehicle: vehicle, onSubmit: vi.fn(), onSuccess: vi.fn() }),
    );
    expect(result.current.formData.vehicle_number).toBe("KA01AB1234");
    expect("id" in result.current.formData).toBe(false);
  });

  it("handleChange updates a field and clears its error", () => {
    const { result } = renderHook(() =>
      useVehicleForm({ onSubmit: vi.fn(), onSuccess: vi.fn() }),
    );

    act(() => {
      result.current.handleSubmit();
    });
    expect(result.current.errors.vehicle_number).toBeDefined();

    act(() => {
      result.current.handleChange({
        target: { id: "vehicle_number", value: "KA05XX9999" },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.formData.vehicle_number).toBe("KA05XX9999");
    expect(result.current.errors.vehicle_number).toBeUndefined();
  });

  it("handleVehicleTypeChange resets type-dependent sub-fields and errors", () => {
    const { result } = renderHook(() =>
      useVehicleForm({ initialVehicle: baseVehicle(), onSubmit: vi.fn(), onSuccess: vi.fn() }),
    );

    act(() => result.current.handleVehicleTypeChange("CONTAINER"));

    expect(result.current.formData.vehicle_type).toBe("CONTAINER");
    expect(result.current.formData.truck_type).toBeNull();
    expect(result.current.formData.seating_capacity).toBeNull();
  });

  it("handleOwnerTypeChange clears owner_name", () => {
    const { result } = renderHook(() =>
      useVehicleForm({ initialVehicle: baseVehicle(), onSubmit: vi.fn(), onSuccess: vi.fn() }),
    );

    act(() => result.current.handleOwnerTypeChange("ENTITY"));

    expect(result.current.formData.owner_type).toBe("ENTITY");
    expect(result.current.formData.owner_name).toBeNull();
  });

  it("handleNumberChange parses ints/floats and clears on empty", () => {
    const { result } = renderHook(() =>
      useVehicleForm({ onSubmit: vi.fn(), onSuccess: vi.fn() }),
    );

    act(() => result.current.handleNumberChange("seating_capacity", "42"));
    expect(result.current.formData.seating_capacity).toBe(42);

    act(() => result.current.handleNumberChange("expected_kml", "3.5", true));
    expect(result.current.formData.expected_kml).toBe(3.5);

    act(() => result.current.handleNumberChange("seating_capacity", ""));
    expect(result.current.formData.seating_capacity).toBeNull();
  });

  it("handleSubmit sets validation errors and does not call onSubmit when invalid", async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useVehicleForm({ onSubmit, onSuccess: vi.fn() }));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);
  });

  it("handleSubmit calls onSubmit and onSuccess when valid", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useVehicleForm({ initialVehicle: baseVehicle(), onSubmit, onSuccess }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.submitError).toBeNull();
  });

  it("handleSubmit surfaces a submit error without calling onSuccess", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: false, error: "boom" });
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useVehicleForm({ initialVehicle: baseVehicle(), onSubmit, onSuccess }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.submitError).toBe("boom");
    expect(result.current.loading).toBe(false);
  });

  it("falls back to a generic submit error message", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: false });
    const { result } = renderHook(() =>
      useVehicleForm({ initialVehicle: baseVehicle(), onSubmit, onSuccess: vi.fn() }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.submitError).toMatch(/unexpected error/i);
  });

  it("clearSubmitError clears the submit error", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: false, error: "boom" });
    const { result } = renderHook(() =>
      useVehicleForm({ initialVehicle: baseVehicle(), onSubmit, onSuccess: vi.fn() }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.submitError).toBe("boom");

    act(() => result.current.clearSubmitError());
    expect(result.current.submitError).toBeNull();
  });

  it("normalizes an empty last_service_date to null on submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() =>
      useVehicleForm({
        initialVehicle: baseVehicle({ last_service_date: "" }),
        onSubmit,
        onSuccess: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ last_service_date: null }),
    );
  });
});
