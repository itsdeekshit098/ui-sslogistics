import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, serverError } from "@/lib/apiResponse";

/**
 * Shared guard + insert for the append-only-ledger reversal pattern used by
 * loan payments, funding entries, and client ledger entries: reject
 * reversing a reversal, reject a second reversal of the same row (checked
 * up front and again via the partial unique index on `reversesColumn`, which
 * catches a concurrent second reversal that slips past the up-front check).
 *
 * Table/column names and the inserted row's shape differ per ledger, so
 * those stay parameters; the guard sequence and error handling — the part
 * that actually enforces the no-double-reversal invariant — lives in one
 * place instead of being hand-copied per route.
 */
export async function reverseLedgerEntry<
  TOriginal extends Record<string, unknown> = Record<string, unknown>,
  TReversal = TOriginal,
>(options: {
  table: string;
  reversesColumn: string;
  ownerColumn: string;
  ownerId: number;
  entryId: number;
  selectColumns: string;
  notFoundMessage: string;
  ownerMismatchMessage: string;
  alreadyReversedMessage: string;
  buildInsertRow: (original: TOriginal) => Record<string, unknown>;
}): Promise<{ reversal: TReversal; response?: undefined } | { reversal?: undefined; response: NextResponse }> {
  const {
    table,
    reversesColumn,
    ownerColumn,
    ownerId,
    entryId,
    selectColumns,
    notFoundMessage,
    ownerMismatchMessage,
    alreadyReversedMessage,
    buildInsertRow,
  } = options;

  const { data: original, error: fetchErr } = await supabaseAdmin
    .from(table)
    .select(selectColumns)
    .eq("id", entryId)
    .maybeSingle();

  if (fetchErr) return { response: serverError(fetchErr) };
  if (!original) return { response: apiError(notFoundMessage, 404) };

  const row = original as unknown as TOriginal;
  if (row[ownerColumn] !== ownerId) {
    return { response: apiError(ownerMismatchMessage, 400) };
  }
  if (row[reversesColumn] != null) {
    return { response: apiError("A reversal cannot itself be reversed", 400) };
  }

  const { data: existingReversal } = await supabaseAdmin
    .from(table)
    .select("id")
    .eq(reversesColumn, entryId)
    .maybeSingle();

  if (existingReversal) {
    return { response: apiError(alreadyReversedMessage, 409) };
  }

  const { data: reversal, error } = await supabaseAdmin
    .from(table)
    .insert([buildInsertRow(row)])
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { response: apiError(alreadyReversedMessage, 409) };
    }
    return { response: serverError(error) };
  }

  return { reversal: reversal as unknown as TReversal };
}
