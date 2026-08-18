import type { Entity } from "@/components/entitiesPage/entitiesPage.types";
import type { AccountType } from "@/components/bankAccountsPage/bankAccountsPage.types";

export const LOAN_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "CLOSED", label: "Closed" },
  { value: "FORECLOSED", label: "Foreclosed" },
  { value: "DEFAULTED", label: "Defaulted" },
] as const;

export type LoanStatus = (typeof LOAN_STATUSES)[number]["value"];

/**
 * Effective status of one scheduled EMI. Never stored — derived by the
 * loan_installment_state view from the payment rows plus today's date, so it
 * can't disagree with the money (sql/31_add_loans.sql).
 */
export type InstallmentStatus =
  | "PAID"
  | "PARTIAL"
  | "OVERDUE"
  | "PENDING"
  | "WAIVED"
  | "BOUNCED";

export const PAYMENT_TYPES = [
  { value: "EMI", label: "EMI" },
  { value: "PREPAYMENT", label: "Prepayment" },
  { value: "FORECLOSURE", label: "Foreclosure" },
  { value: "CHARGE", label: "Charge / Penalty" },
  { value: "ADJUSTMENT", label: "Adjustment" },
] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number]["value"];

export interface Lender {
  id: number;
  name: string;
  lender_kind: "INSTITUTION" | "PRIVATE";
  phone: string | null;
  contact_person: string | null;
  is_active: boolean;
}

export interface LinkedVehicle {
  id: number;
  vehicle_number: string;
  vehicle_type: string;
  company: string | null;
  model: string | null;
}

/** Derived per-loan figures from the loan_balances view. */
export interface LoanBalance {
  loan_id: number;
  total_payable: number;
  total_paid: number;
  total_charges: number;
  outstanding: number;
  installments_paid: number;
  installments_left: number;
  next_due_date: string | null;
  next_due_amount: number | null;
  overdue_count: number;
  overdue_amount: number;
  final_due_date: string | null;
  last_payment_date: string | null;
}

export interface Loan {
  id: number;
  loan_type: string;
  borrower_entity_id: number;
  lender_id: number | null;
  loan_number: string | null;
  vehicle_id: number | null;
  collateral_description: string | null;
  principal_amount: number;
  disbursed_amount: number | null;
  interest_rate: number | null;
  processing_fee: number | null;
  start_date: string;
  first_emi_date: string;
  emi_amount: number;
  emi_day_of_month: number;
  total_installments: number;
  outstanding_override: number | null;
  debit_account_id: number | null;
  mandate_type: string | null;
  status: LoanStatus;
  closed_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Embedded relations, named after the referenced table by PostgREST.
  entities?: Pick<Entity, "id" | "name" | "entity_kind" | "relationship"> | null;
  lenders?: Pick<Lender, "id" | "name" | "lender_kind"> | null;
  vehicles?: LinkedVehicle | null;
  bank_accounts?: LoanBankAccountRef | null;
  balance: LoanBalance;
}

/** The debit-account embed on a loan — a narrower shape than the full
 * BankAccount record, with the holder's name resolved inline. */
export interface LoanBankAccountRef {
  id: number;
  bank_name: string;
  account_number: string;
  account_type: AccountType;
  nickname: string | null;
  entities?: { name: string } | null;
}

export interface LoanInstallment {
  id: number;
  loan_id: number;
  installment_no: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  manual_status: "WAIVED" | "BOUNCED" | null;
  status: InstallmentStatus;
  notes: string | null;
}

export interface LoanPayment {
  id: number;
  loan_id: number;
  installment_id: number | null;
  payment_type: PaymentType;
  amount: number;
  paid_on: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  reverses_payment_id: number | null;
  is_reversed: boolean;
  is_reversal: boolean;
  created_at: string;
}

export interface LoanSummary {
  totalOutstanding: number;
  totalMonthlyEmi: number;
  dueThisMonth: number;
  overdueCount: number;
  overdueAmount: number;
  activeLoans: number;
  openFundings: number;
  fundingPrincipalOutstanding: number;
}

// ─── Private fundings ───

export const INTEREST_MODES = [
  { value: "PERCENT", label: "Percentage of principal" },
  { value: "FIXED", label: "Fixed amount per month" },
] as const;

export type InterestMode = (typeof INTEREST_MODES)[number]["value"];

export const ROI_BASES = [
  { value: "MONTHLY", label: "per month" },
  { value: "ANNUAL", label: "per year" },
] as const;

export type RoiBasis = (typeof ROI_BASES)[number]["value"];

export const FUNDING_ENTRY_TYPES = [
  { value: "PRINCIPAL_TAKEN", label: "Borrowed more" },
  { value: "PRINCIPAL_REPAID", label: "Repaid principal" },
  { value: "INTEREST_PAID", label: "Paid interest" },
  { value: "ADJUSTMENT", label: "Adjustment / write-off" },
] as const;

export type FundingEntryType = (typeof FUNDING_ENTRY_TYPES)[number]["value"];
export type FundingDirection = "BORROWED" | "LENT";

/** Same entry types, borrower voice vs. lender voice. The DB values never
 * change — only how they're described (see sql/35_add_funding_direction.sql). */
const FUNDING_ENTRY_TYPE_LABELS_BY_DIRECTION: Record<
  FundingDirection,
  Record<FundingEntryType, string>
> = {
  BORROWED: {
    PRINCIPAL_TAKEN: "Borrowed more",
    PRINCIPAL_REPAID: "Repaid principal",
    INTEREST_PAID: "Paid interest",
    ADJUSTMENT: "Adjustment / write-off",
  },
  LENT: {
    PRINCIPAL_TAKEN: "Lent more",
    PRINCIPAL_REPAID: "Principal recovered",
    INTEREST_PAID: "Interest received",
    ADJUSTMENT: "Adjustment / write-off",
  },
};

export interface FundingRate {
  id: number;
  funding_id: number;
  roi: number | null;
  roi_basis: RoiBasis | null;
  fixed_interest_amount: number | null;
  effective_from: string;
  note: string | null;
}

export interface MonthlyBreakdownRow {
  month: string;
  days: number;
  average_principal: number;
  monthly_rate: number | null;
  interest_accrued: number;
  interest_paid: number;
  interest_balance: number;
}

/** Interest position, recomputed server-side on every read — never stored. */
export interface FundingComputation {
  principal_taken: number;
  principal_repaid: number;
  principal_outstanding: number;
  interest_accrued: number;
  interest_paid: number;
  interest_due: number;
  total_due: number;
  monthly_breakdown: MonthlyBreakdownRow[];
}

export interface Funding {
  id: number;
  funder_id: number | null;
  borrower_entity_id: number | null;
  counterparty_entity_id: number | null;
  direction: FundingDirection;
  linked_loan_id: number | null;
  interest_mode: InterestMode;
  interest_due_day: number | null;
  start_date: string;
  status: "OPEN" | "SETTLED";
  settled_on: string | null;
  notes: string | null;
  lenders?: Pick<Lender, "id" | "name" | "lender_kind" | "phone"> | null;
  borrower?: Pick<Entity, "id" | "name" | "entity_kind"> | null;
  counterparty?: Pick<Entity, "id" | "name" | "entity_kind"> | null;
  loans?: { id: number; loan_type: string; loan_number: string | null } | null;
  computed: FundingComputation | null;
  current_rate: FundingRate | null;
}

export interface FundingEntry {
  id: number;
  funding_id: number;
  entry_type: FundingEntryType;
  amount: number;
  entry_date: string;
  payment_method: string | null;
  reference: string | null;
  description: string | null;
  reverses_entry_id: number | null;
  is_reversed: boolean;
  is_reversal: boolean;
  created_at: string;
}

// ─── EMI calendar ───

export interface CalendarInstallment extends LoanInstallment {
  loan: {
    id: number;
    loan_type: string;
    loan_number: string | null;
    status: LoanStatus;
    entities?: { id: number; name: string } | null;
    lenders?: { id: number; name: string } | null;
    vehicles?: { id: number; vehicle_number: string } | null;
  } | null;
}

export interface CalendarDay {
  date: string;
  is_overdue: boolean;
  total: number;
  installments: CalendarInstallment[];
}

export const LOAN_NOTES_MAX_LENGTH = 500;

export function getLoanStatusLabel(status: string): string {
  return LOAN_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function getPaymentTypeLabel(type: string): string {
  return PAYMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function getFundingEntryTypeLabel(
  type: string,
  direction: FundingDirection = "BORROWED",
): string {
  return (
    FUNDING_ENTRY_TYPE_LABELS_BY_DIRECTION[direction][type as FundingEntryType] ?? type
  );
}

/** "Total Owed" for money we owe, "Total Receivable" for money owed to us. */
export function getFundingTotalDueLabel(direction: FundingDirection): string {
  return direction === "LENT" ? "Total Receivable" : "Total Owed";
}
