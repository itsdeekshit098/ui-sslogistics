// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddDriverModal from "@/components/addDriverModal/addDriverModal";

describe("AddDriverModal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the similar-name warning returned by the server after Save", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: "A similar driver already exists",
        code: "SIMILAR_DRIVER_EXISTS",
        similar: [
          { id: 1, name: "Ravi Kumar", place: "Chennai", phone: "9876543210", is_active: true },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AddDriverModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />,
    );

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Ravi Kumar" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save driver/i }));

    expect(
      await screen.findByText(/a driver with a similar name already exists/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/drivers",
      expect.objectContaining({ method: "POST" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add anyway/i })).toBeInTheDocument(),
    );
  });
});
