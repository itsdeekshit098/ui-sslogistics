import type { AccountType } from "@/components/bankAccountsPage/bankAccountsPage.types";

export const LEDGER_ENTRY_TYPES = [
  { value: "OPENING", label: "Opening balance" },
  { value: "BILL", label: "Bill" },
  { value: "PAYMENT", label: "Payment" },
  { value: "ADJUSTMENT", label: "Adjustment" },
] as const;

export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number]["value"];

/** DEBIT increases what the client owes us; CREDIT reduces it. */
export type LedgerDirection = "DEBIT" | "CREDIT";

/**
 * Derived receivables position from the client_balances view. Outstanding is
 * always sum(debits) − sum(credits) over the live ledger rows, never stored
 * (sql/33_add_clients.sql).
 */
export interface ClientBalance {
  client_id: number;
  total_billed: number;
  total_paid: number;
  outstanding: number;
  /** Positive when they have overpaid — money held on account. */
  advance_amount: number;
  last_payment_date: string | null;
  last_entry_date: string | null;
  oldest_unpaid_date: string | null;
  entry_count: number;
}

export const PARTY_KINDS = [
  { value: "COMPANY", label: "Company" },
  { value: "INDIVIDUAL", label: "Individual" },
] as const;

export type PartyKind = (typeof PARTY_KINDS)[number]["value"];

export interface Client {
  id: number;
  name: string;
  client_type: string;
  location: string | null;
  address: string | null;
  gst_number: string | null;
  notes: string | null;
  is_active: boolean;
  party_kind: PartyKind;
  entity_id: number | null;
  entities?: { id: number; name: string; entity_kind: string; phone: string | null } | null;
  receiving_account_id: number | null;
  bank_accounts?: ClientBankAccountRef | null;
  created_at: string;
  updated_at: string;
  balance: ClientBalance;
  /** Active deployed vehicles counted by type, e.g. { BUS: 4, CONTAINER: 2 }. */
  deployment_mix: Record<string, number>;
}

/** The receiving-account embed on a client — a narrower shape than the full
 * BankAccount record, with the holder's name resolved inline. */
export interface ClientBankAccountRef {
  id: number;
  bank_name: string;
  account_number: string;
  account_type: AccountType;
  nickname: string | null;
  entities?: { name: string } | null;
}

export interface ClientSummary {
  totalClients: number;
  activeClients: number;
  totalOutstanding: number;
  totalAdvance: number;
  clientsWithDues: number;
}

export interface LedgerEntry {
  id: number;
  client_id: number;
  entry_type: LedgerEntryType;
  direction: LedgerDirection;
  amount: number;
  entry_date: string;
  invoice_no: string | null;
  period_month: string | null;
  payment_method: string | null;
  reference: string | null;
  description: string | null;
  reverses_entry_id: number | null;
  /** Balance after this entry, in chronological order — computed server-side. */
  running_balance: number;
  is_reversed: boolean;
  is_reversal: boolean;
  attachment_count: number;
  created_at: string;
}

export interface ClientContact {
  id: number;
  client_id: number;
  name: string;
  role: string | null;
  designation: string | null;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  notes: string | null;
  is_primary: boolean;
}

export interface DeploymentVehicle {
  id: number;
  vehicle_number: string;
  company: string | null;
  model: string | null;
}

/**
 * A vehicle running for a client. Either linked to one of our fleet vehicles
 * (vehicle_id set, quantity 1) or a declared bucket describing units we don't
 * track individually (vehicle_id null, quantity ≥ 1).
 */
export interface ClientDeployment {
  id: number;
  client_id: number;
  vehicle_id: number | null;
  quantity: number;
  vehicle_type: string;
  seating_capacity: number | null;
  truck_type: string | null;
  container_length: string | null;
  axle_type: string | null;
  container_body_type: string | null;
  monthly_rate: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  vehicles?: DeploymentVehicle | null;
}

export const CLIENT_NOTES_MAX_LENGTH = 500;
export const LEDGER_DESCRIPTION_MAX_LENGTH = 300;
