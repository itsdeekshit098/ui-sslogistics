// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { FundingModal } from "@/components/fundingModal/fundingModal";

vi.mock("@/components/entityModal", () => ({ EntityModal: () => null }));
vi.mock("@/components/lenderModal", () => ({ LenderModal: () => null }));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-15T10:00:00+05:30"));
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => ({
    ok: true,
    json: async () =>
      init?.method === "POST"
        ? { data: {} }
        : { data: { data: [{ id: 9, name: "Ravi Funder", lender_kind: "PRIVATE", phone: null }] } },
  }));
  vi.stubGlobal("fetch", fetchMock);
  // jsdom has no matchMedia; the combobox asks whether the pointer is coarse
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("FundingModal", () => {
  it("defaults the date to today in India and previews a month's interest as you type", async () => {
    render(<FundingModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/Date Borrowed/)).toHaveTextContent("15 Jun 2026");

    fireEvent.change(screen.getByLabelText(/Amount Borrowed/), { target: { value: "100000" } });
    fireEvent.change(screen.getByLabelText(/Rate \(%\)/), { target: { value: "2" } });
    expect(await screen.findByText(/a full month costs/)).toHaveTextContent("₹2,000");
  });

  it("says what is missing and sends nothing", async () => {
    const onSuccess = vi.fn();
    render(<FundingModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Funding" }));
    expect(await screen.findByText("Funder is required")).toBeInTheDocument();
    expect(screen.getByText("Enter the amount borrowed")).toBeInTheDocument();
    expect(screen.getByText("Enter the rate")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("rejects an interest day outside 1–31 and refuses a pasted third decimal", async () => {
    render(<FundingModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    const amount = screen.getByLabelText(/Amount Borrowed/);
    fireEvent.change(amount, { target: { value: "12.34" } });
    fireEvent.change(amount, { target: { value: "12.345" } }); // a paste with a third decimal is refused whole
    expect(amount).toHaveValue("12.34");
    fireEvent.change(screen.getByLabelText(/Interest Expected On/), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Funding" }));
    expect(await screen.findByText("Day must be between 1 and 31")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === "POST")).toBe(false));
  });

  it("clears the funder's \"required\" message once a funder is picked", async () => {
    render(<FundingModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Funding" }));
    expect(await screen.findByText("Funder is required")).toBeInTheDocument();

    const funder = screen.getByRole("combobox", { name: /Funder/ });
    await waitFor(() => expect(funder).toBeEnabled()); // disabled while the funders load
    fireEvent.focus(funder); // the list opens on focus
    fireEvent.click(await screen.findByRole("option", { name: /Ravi Funder/ }));
    await waitFor(() => expect(screen.queryByText("Funder is required")).not.toBeInTheDocument());
    // the other messages stay until those fields are fixed
    expect(screen.getByText("Enter the amount borrowed")).toBeInTheDocument();
  });
});
