// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ClientModal } from "@/components/clientModal/clientModal";
import type { Client } from "@/components/clientsPage/clientsPage.types";

vi.mock("@/components/entityModal", () => ({ EntityModal: () => null }));
vi.mock("@/components/bankAccountModal", () => ({ BankAccountModal: () => null }));
vi.mock("@/components/lookupSelect", () => ({ LookupSelect: () => null }));

const client = {
  id: 7,
  name: "Acme",
  client_type: "VENDOR",
  location: null,
  address: null,
  gst_number: null,
  notes: null,
  is_active: true,
  party_kind: "COMPANY",
  entity_id: null,
  receiving_account_id: null,
  created_at: "",
  updated_at: "",
  balance: {},
  deployment_mix: {},
} as unknown as Client;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) => ({
    ok: true,
    json: async () => (init?.method === "PUT" ? { data: {} } : { data: { data: [] } }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

const putBody = () => {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
  return call ? JSON.parse(call[1].body) : null;
};

describe("ClientModal active switch", () => {
  it("is on for an active client and is sent as false once switched off", async () => {
    render(<ClientModal isOpen clientToEdit={client} onClose={vi.fn()} onSuccess={vi.fn()} />);
    const toggle = screen.getByRole("switch", { name: "Active" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("button", { name: "Update Client" }));
    await waitFor(() => expect(putBody()).not.toBeNull());
    expect(putBody().is_active).toBe(false);
  });

  it("starts off for an inactive client", () => {
    render(
      <ClientModal isOpen clientToEdit={{ ...client, is_active: false }} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );
    expect(screen.getByRole("switch", { name: "Active" })).toHaveAttribute("aria-checked", "false");
  });

  it("is not shown when adding a new client", () => {
    render(<ClientModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.queryByRole("switch", { name: "Active" })).not.toBeInTheDocument();
  });
});
