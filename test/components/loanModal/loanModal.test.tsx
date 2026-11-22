// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { LoanModal } from "@/components/loanModal/loanModal";
import type { Loan } from "@/components/loansPage/loansPage.types";

vi.mock("@/components/entityModal", () => ({ EntityModal: () => null }));
vi.mock("@/components/lenderModal", () => ({ LenderModal: () => null }));
vi.mock("@/components/bankAccountModal", () => ({ BankAccountModal: () => null }));
vi.mock("@/components/lookupSelect", () => ({
  LookupSelect: ({ value }: { value: string }) => <input aria-label="Loan Type" readOnly value={value} />,
}));

const loan = {
  id: 7,
  loan_type: "PERSONAL",
  borrower_entity_id: 501,
  lender_id: 601,
  loan_number: "LN-1",
  vehicle_id: null,
  collateral_description: null,
  principal_amount: 200000.5,
  disbursed_amount: null,
  interest_rate: 10.25,
  processing_fee: 1500,
  start_date: "2026-01-31",
  first_emi_date: "2026-02-28",
  emi_amount: 20000,
  emi_day_of_month: 28,
  total_installments: 12,
  outstanding_override: null,
  debit_account_id: null,
  mandate_type: null,
  status: "ACTIVE",
  closed_on: null,
  notes: null,
} as unknown as Loan;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => ({
    ok: true,
    json: async () => (init?.method ? { data: {} } : { data: { data: [] } }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("LoanModal (edit)", () => {
  it("shows the saved numbers and dates, and sends them back as numbers", async () => {
    const onSuccess = vi.fn();
    render(<LoanModal isOpen loanToEdit={loan} onClose={vi.fn()} onSuccess={onSuccess} />);

    expect(screen.getByLabelText(/Principal Amount/)).toHaveValue("200000.5");
    expect(screen.getByLabelText(/Interest Rate/)).toHaveValue("10.25");
    expect(screen.getByLabelText(/Processing Fee/)).toHaveValue("1500");
    expect(screen.getByLabelText(/EMI Day of Month/)).toHaveValue("28");
    expect(screen.getByLabelText(/Total Installments/)).toHaveValue("12");
    expect(screen.getByLabelText(/Start Date/)).toHaveTextContent("31 Jan 2026");
    expect(screen.getByLabelText(/First EMI Date/)).toHaveTextContent("28 Feb 2026");

    fireEvent.change(screen.getByLabelText(/EMI Amount/), { target: { value: "21000" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Loan" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(JSON.parse(put[1].body)).toMatchObject({
      id: 7,
      principal_amount: 200000.5,
      interest_rate: 10.25,
      processing_fee: 1500,
      disbursed_amount: null,
      outstanding_override: null,
      emi_amount: 21000,
      emi_day_of_month: 28,
      total_installments: 12,
      start_date: "2026-01-31",
      first_emi_date: "2026-02-28",
    });
  });

  it("names the empty required fields instead of sending anything", async () => {
    render(<LoanModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Loan" }));
    expect(await screen.findByText("Enter the principal amount")).toBeInTheDocument();
    expect(screen.getByText("Enter the EMI amount")).toBeInTheDocument();
    expect(screen.getByText("EMI day must be between 1 and 31")).toBeInTheDocument();
    expect(screen.getByText("Enter the number of installments")).toBeInTheDocument();
    expect(screen.getByLabelText(/Principal Amount/)).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("clears the red errors on the fields it fills in when the start date is chosen", async () => {
    render(<LoanModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Loan" }));
    expect(await screen.findByText("First EMI date is required")).toBeInTheDocument();
    expect(screen.getByText("EMI day must be between 1 and 31")).toBeInTheDocument();

    // Pick today as the start date from the calendar.
    fireEvent.click(screen.getByLabelText(/Start Date/));
    fireEvent.click(await screen.findByRole("button", { name: "Today" }));

    await waitFor(() => expect(screen.queryByText("First EMI date is required")).toBeNull());
    expect(screen.queryByText("EMI day must be between 1 and 31")).toBeNull();
    expect(screen.queryByText("Start date is required")).toBeNull();
  });
});
