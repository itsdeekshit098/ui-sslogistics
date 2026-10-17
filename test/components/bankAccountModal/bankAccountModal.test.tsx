// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { BankAccountModal } from "@/components/bankAccountModal/bankAccountModal";
import type { BankAccount } from "@/components/bankAccountsPage/bankAccountsPage.types";

vi.mock("@/components/entityModal", () => ({
  EntityModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="entity-modal-stub">Entity Modal</div> : null,
}));

vi.mock("@/components/lookupSelect", () => ({
  LookupSelect: ({
    value,
    onValueChange,
    invalid,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    invalid?: boolean;
  }) => (
    <input
      aria-label="Bank"
      aria-invalid={invalid}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
}));

const entities = [
  { id: 1, name: "Acme Corp", entity_kind: "FIRM" },
  { id: 2, name: "Jane Doe", entity_kind: "PERSON" },
];

function mockEntitiesFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { data: entities } }),
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BankAccountModal", () => {
  it("renders nothing when closed", () => {
    render(
      <BankAccountModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows 'Add Bank Account' title in create mode and loads entities", async () => {
    vi.stubGlobal("fetch", mockEntitiesFetch());
    render(<BankAccountModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText("Add Bank Account")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/held by/i)).not.toBeDisabled());
  });

  it("shows 'Edit Bank Account' and pre-fills the form when editing", async () => {
    vi.stubGlobal("fetch", mockEntitiesFetch());
    const account: BankAccount = {
      id: 5,
      holder_entity_id: 1,
      bank_name: "HDFC",
      account_number: "123456789012",
      account_type: "SAVINGS",
      ifsc: "HDFC0001234",
      branch: "MG Road",
      nickname: "Main",
      notes: "",
    } as BankAccount;
    render(
      <BankAccountModal isOpen accountToEdit={account} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );
    expect(screen.getByText("Edit Bank Account")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123456789012")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Main")).toBeInTheDocument();
  });

  it("shows validation errors and does not submit when required fields are missing", async () => {
    vi.stubGlobal("fetch", mockEntitiesFetch());
    render(<BankAccountModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/held by/i)).not.toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(await screen.findByText("Holder is required")).toBeInTheDocument();
    expect(screen.getByText("Bank is required")).toBeInTheDocument();
    expect(screen.getByText(/enter a valid account number/i)).toBeInTheDocument();
  });

  it("rejects an account number that is not 6-20 digits", async () => {
    vi.stubGlobal("fetch", mockEntitiesFetch());
    render(<BankAccountModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/held by/i)).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText("Bank"), { target: { value: "HDFC" } });
    fireEvent.change(screen.getByLabelText(/account number/i), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(await screen.findByText(/enter a valid account number/i)).toBeInTheDocument();
  });

  it("rejects an invalid IFSC code format", async () => {
    vi.stubGlobal("fetch", mockEntitiesFetch());
    render(<BankAccountModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/held by/i)).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText(/ifsc/i), { target: { value: "NOTVALID" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(await screen.findByText(/enter a valid ifsc code/i)).toBeInTheDocument();
  });

  it("submits a valid form via POST and calls onSuccess + onClose", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("entities")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: { data: entities } }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: { bank_account: { id: 9 } } }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(<BankAccountModal isOpen onClose={onClose} onSuccess={onSuccess} />);
    await waitFor(() => expect(screen.getByLabelText(/held by/i)).not.toBeDisabled());

    // Typeahead for holder: select the first option.
    fireEvent.focus(screen.getByLabelText(/held by/i));
    fireEvent.click(screen.getByRole("option", { name: /acme corp/i }));

    fireEvent.change(screen.getByLabelText("Bank"), { target: { value: "HDFC" } });
    fireEvent.change(screen.getByLabelText(/account number/i), {
      target: { value: "123456789012" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 9 }));
    expect(onClose).toHaveBeenCalled();

    const postCall = fetchMock.mock.calls.find(
      (c) => c[0] === "/api/bank-accounts",
    );
    expect(postCall?.[1]).toMatchObject({ method: "POST" });
    const body = JSON.parse(postCall![1].body as string);
    expect(body).toMatchObject({
      holder_entity_id: 1,
      bank_name: "HDFC",
      account_number: "123456789012",
      ifsc: null,
    });
  });

  it("submits via PUT with the account id when editing", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("entities")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: { data: entities } }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: { bank_account: { id: 5 } } }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const account: BankAccount = {
      id: 5,
      holder_entity_id: 1,
      bank_name: "HDFC",
      account_number: "123456789012",
      account_type: "SAVINGS",
      ifsc: null,
      branch: null,
      nickname: null,
      notes: null,
    } as BankAccount;

    render(
      <BankAccountModal isOpen accountToEdit={account} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByLabelText(/held by/i)).not.toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find((c) => c[0] === "/api/bank-accounts");
      expect(putCall?.[1]).toMatchObject({ method: "PUT" });
      const body = JSON.parse(putCall![1].body as string);
      expect(body.id).toBe(5);
    });
  });

  it("shows the server's error message and does not close on a failed submit", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("entities")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: { data: entities } }) });
      }
      return Promise.resolve({
        ok: false,
        json: async () => ({ error: "Duplicate account" }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const onClose = vi.fn();
    render(<BankAccountModal isOpen onClose={onClose} onSuccess={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/held by/i)).not.toBeDisabled());

    fireEvent.focus(screen.getByLabelText(/held by/i));
    fireEvent.click(screen.getByRole("option", { name: /acme corp/i }));
    fireEvent.change(screen.getByLabelText("Bank"), { target: { value: "HDFC" } });
    fireEvent.change(screen.getByLabelText(/account number/i), {
      target: { value: "123456789012" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(await screen.findByText("Duplicate account")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Cancel calls onClose when not loading", async () => {
    vi.stubGlobal("fetch", mockEntitiesFetch());
    const onClose = vi.fn();
    render(<BankAccountModal isOpen onClose={onClose} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens the inline Add Entity modal from the typeahead footer", async () => {
    vi.stubGlobal("fetch", mockEntitiesFetch());
    render(<BankAccountModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/held by/i)).not.toBeDisabled());

    fireEvent.focus(screen.getByLabelText(/held by/i));
    fireEvent.click(screen.getByRole("button", { name: /add new firm or person/i }));

    expect(screen.getByTestId("entity-modal-stub")).toBeInTheDocument();
  });
});
