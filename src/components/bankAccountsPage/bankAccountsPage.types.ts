import type { Entity } from "@/components/entitiesPage/entitiesPage.types";

export const ACCOUNT_TYPES = [
  { value: "SAVINGS", label: "Savings" },
  { value: "CURRENT", label: "Current" },
  { value: "OD", label: "Overdraft (OD)" },
  { value: "CC", label: "Cash Credit (CC)" },
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];

export const MANDATE_TYPES = [
  { value: "NACH", label: "NACH" },
  { value: "ECS", label: "ECS" },
  { value: "SI", label: "Standing Instruction" },
  { value: "PDC", label: "Post-Dated Cheques" },
  { value: "MANUAL", label: "Manual" },
] as const;

export type MandateType = (typeof MANDATE_TYPES)[number]["value"];

/**
 * One of our own bank accounts — not a lender, not a loan reference. Recorded
 * so a loan can say which account its EMI mandate debits (sql/34_add_bank_accounts.sql).
 * Deliberately not referenced from any payment row; see that migration's header
 * for why a per-account balance can't be derived here.
 */
export interface BankAccount {
  id: number;
  holder_entity_id: number;
  bank_name: string;
  account_number: string;
  account_type: AccountType;
  ifsc: string | null;
  branch: string | null;
  nickname: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  entities?: Pick<Entity, "id" | "name" | "entity_kind"> | null;
  /** Present only when the list is requested with `with_counts=true`. */
  loan_count?: number;
}

export interface BankAccountListResponse {
  data: BankAccount[];
  total: number;
}

export const BANK_ACCOUNT_NOTES_MAX_LENGTH = 500;

export function getAccountTypeLabel(value: string): string {
  return ACCOUNT_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function getMandateTypeLabel(value: string | null): string | null {
  if (!value) return null;
  return MANDATE_TYPES.find((t) => t.value === value)?.label ?? value;
}

/**
 * "Axis Bank ••81 — Deekshith (Savings)". Derived, never stored. `bank_name`
 * is itself the display name (the lookup_options value == label for this
 * category), so no separate label lookup is needed.
 */
export function formatBankAccountLabel(
  account: Pick<BankAccount, "bank_name" | "account_number" | "account_type" | "nickname">,
  holderName?: string | null,
): string {
  const last4 = account.account_number.slice(-4);
  const head = account.nickname?.trim() || `${account.bank_name} ••${last4}`;
  const typeLabel = getAccountTypeLabel(account.account_type);
  return holderName ? `${head} — ${holderName} (${typeLabel})` : `${head} (${typeLabel})`;
}
