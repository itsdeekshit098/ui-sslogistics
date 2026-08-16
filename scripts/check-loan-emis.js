/* eslint-disable @typescript-eslint/no-require-imports */
// Daily job: warns an admin the day before an EMI falls due, nags about EMIs
// that came and went unpaid, and flags a loan approaching its final
// installment. Mirrors scripts/check-document-expiry.js's structure (plain
// CommonJS, talks to Supabase directly via the service-role key) rather than
// depending on Next.js request context, since it runs as a standalone GitHub
// Actions job, not an API route.
//
// Reads loan_installment_state (sql/31_add_loans.sql) rather than the raw
// installments table, so "unpaid" means what the payment rows actually say —
// not merely that the due date has passed.
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Checkpoints, in days PAST the due date, at which an unpaid EMI gets chased
// again. Checked oldest-first so a job that missed a run (or its first run
// against existing data) still backfills every checkpoint genuinely crossed,
// not just the nearest one — same approach as the document-expiry script.
const OVERDUE_CHECKPOINTS = [1, 7, 15, 30];

// Days before the final installment at which we flag the loan for closure, so
// there's time to confirm it and chase the NOC / hypothecation release.
const CLOSURE_LEAD_DAYS = 7;

const RECIPIENT_ROLES = ["admin", "superadmin"];
const RETENTION_DAYS = 30;

let firebaseReady = false;
try {
  if (FIREBASE_SERVICE_ACCOUNT_JSON) {
    const { cert, initializeApp } = require("firebase-admin/app");
    initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)) });
    firebaseReady = true;
  } else {
    console.warn(
      "FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications skipped, in-app only.",
    );
  }
} catch (err) {
  console.error("Failed to initialize Firebase Admin SDK:", err.message);
}

/** YYYY-MM-DD, offset by whole days. Matches how `date` columns compare. */
function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromStr, toStr) {
  return Math.round(
    (new Date(toStr).getTime() - new Date(fromStr).getTime()) / 86_400_000,
  );
}

function formatRupees(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// Role isn't a queryable column — it lives only in auth.users.app_metadata —
// so recipients have to be resolved by paging the admin API.
async function resolveUserIdsForRoles(roles) {
  const userIds = [];
  const perPage = 200;
  let page = 1;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("Failed to list users:", error.message);
      break;
    }
    const users = data.users || [];
    for (const u of users) {
      const role = u.app_metadata && u.app_metadata.role;
      if (role && roles.includes(role)) userIds.push(u.id);
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return userIds;
}

async function sendPushToUsers(userIds, { title, body, data = {} }) {
  if (!firebaseReady || userIds.length === 0) return;

  const { data: tokenRows, error } = await supabase
    .from("device_push_tokens")
    .select("token")
    .in("user_id", userIds);

  if (error) {
    console.error("Failed to load device push tokens:", error.message);
    return;
  }

  const tokens = (tokenRows || []).map((r) => r.token);
  if (tokens.length === 0) return;

  const stringData = {};
  for (const [k, v] of Object.entries(data)) stringData[k] = String(v);

  const { getMessaging } = require("firebase-admin/messaging");

  try {
    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: stringData,
    });

    const deadTokens = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && r.error) {
        const code = r.error.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          deadTokens.push(tokens[idx]);
        }
      }
    });

    if (deadTokens.length > 0) {
      await supabase.from("device_push_tokens").delete().in("token", deadTokens);
    }
  } catch (err) {
    console.error("Push send failed:", err.message);
  }
}

/**
 * True if this exact reminder has already gone out. The key is the installment
 * (or loan) plus the checkpoint, so a re-run — or two runs in one day — can't
 * send the same nag twice, while a genuinely new checkpoint still fires.
 */
async function alreadyNotified(type, key) {
  let query = supabase.from("notifications").select("id").eq("type", type);

  for (const [field, value] of Object.entries(key)) {
    query = query.eq(`metadata->>${field}`, String(value));
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    console.error("Failed to check existing notifications:", error.message);
    return true; // fail safe — skip rather than risk duplicate spam
  }
  return !!data;
}

async function notify({ userIds, type, title, body, linkPath, metadata }) {
  const rows = userIds.map((userId) => ({
    user_id: userId,
    type,
    title,
    body,
    link_path: linkPath,
    metadata,
  }));

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error(`Failed to insert ${type} notifications:`, error.message);
    return false;
  }

  await sendPushToUsers(userIds, {
    title,
    body,
    data: { type, linkPath, ...metadata },
  });
  return true;
}

/** Loan context for a set of installments, in one query rather than per row. */
async function loadLoanContext(loanIds) {
  const { data, error } = await supabase
    .from("loans")
    .select(
      "id, loan_type, status, lenders:lender_id (name), entities:borrower_entity_id (name), bank_accounts:debit_account_id (bank_name, account_number, nickname)",
    )
    .in("id", loanIds);

  if (error) {
    console.error("Failed to load loans:", error.message);
    return new Map();
  }

  return new Map((data || []).map((loan) => [loan.id, loan]));
}

function describeLoan(loan) {
  if (!loan) return "a loan";
  const lender = loan.lenders && loan.lenders.name;
  const borrower = loan.entities && loan.entities.name;
  return [lender || loan.loan_type, borrower].filter(Boolean).join(" · ");
}

/** "Debits from Axis Bank ••81." — empty string when no account is on file,
 * so the reminder stays a plain fact rather than reading "from " nowhere. */
function describeDebitAccount(loan) {
  const account = loan && loan.bank_accounts;
  if (!account) return "";
  const last4 = String(account.account_number || "").slice(-4);
  const head = (account.nickname && account.nickname.trim()) || `${account.bank_name} ••${last4}`;
  return ` Debits from ${head}.`;
}

async function checkEmiReminders(userIds) {
  const tomorrow = dateStr(1);
  const today = dateStr(0);
  let created = 0;

  // ─── Due tomorrow ───
  const { data: dueTomorrow, error: dueErr } = await supabase
    .from("loan_installment_state")
    .select("id, loan_id, installment_no, due_date, amount_remaining, status")
    .eq("due_date", tomorrow)
    .in("status", ["PENDING", "PARTIAL"]);

  if (dueErr) {
    console.error("Failed to load installments due tomorrow:", dueErr.message);
  }

  // ─── Overdue: unpaid and the date has passed ───
  const { data: overdue, error: overdueErr } = await supabase
    .from("loan_installment_state")
    .select("id, loan_id, installment_no, due_date, amount_remaining, status")
    .lt("due_date", today)
    .in("status", ["OVERDUE", "PARTIAL", "BOUNCED"]);

  if (overdueErr) {
    console.error("Failed to load overdue installments:", overdueErr.message);
  }

  const all = [...(dueTomorrow || []), ...(overdue || [])];
  if (all.length === 0) return 0;

  const loans = await loadLoanContext([...new Set(all.map((i) => i.loan_id))]);

  for (const installment of dueTomorrow || []) {
    const loan = loans.get(installment.loan_id);
    // A closed loan's leftover schedule rows aren't owed any more.
    if (!loan || loan.status !== "ACTIVE") continue;

    if (await alreadyNotified("loan_emi_due", { installment_id: installment.id })) {
      continue;
    }

    const sent = await notify({
      userIds,
      type: "loan_emi_due",
      title: "EMI due tomorrow",
      body: `${formatRupees(installment.amount_remaining)} EMI for ${describeLoan(loan)} is due tomorrow.${describeDebitAccount(loan)}`,
      linkPath: `/admin/loans/${installment.loan_id}`,
      metadata: {
        loan_id: installment.loan_id,
        installment_id: installment.id,
        checkpoint: "due_tomorrow",
      },
    });
    if (sent) created += 1;
  }

  for (const installment of overdue || []) {
    const loan = loans.get(installment.loan_id);
    if (!loan || loan.status !== "ACTIVE") continue;

    const daysLate = daysBetween(installment.due_date, today);

    // Oldest checkpoint first, so a long-missed run backfills in order and the
    // most recent one it sends is the most relevant.
    for (const checkpoint of OVERDUE_CHECKPOINTS) {
      if (daysLate < checkpoint) continue;

      const key = { installment_id: installment.id, checkpoint: String(checkpoint) };
      if (await alreadyNotified("loan_emi_overdue", key)) continue;

      const sent = await notify({
        userIds,
        type: "loan_emi_overdue",
        title: `EMI overdue by ${checkpoint} day${checkpoint === 1 ? "" : "s"}`,
        body: `${formatRupees(installment.amount_remaining)} for ${describeLoan(loan)} was due on ${installment.due_date} and is still unpaid.${describeDebitAccount(loan)}`,
        linkPath: `/admin/loans/${installment.loan_id}`,
        metadata: {
          loan_id: installment.loan_id,
          installment_id: installment.id,
          checkpoint: String(checkpoint),
        },
      });
      if (sent) created += 1;
    }
  }

  return created;
}

async function checkLoansNearingClosure(userIds) {
  const { data: balances, error } = await supabase
    .from("loan_balances")
    .select("loan_id, final_due_date, installments_left, outstanding");

  if (error) {
    console.error("Failed to load loan balances:", error.message);
    return 0;
  }

  const today = dateStr(0);
  const candidates = (balances || []).filter((b) => {
    if (!b.final_due_date) return false;
    const daysOut = daysBetween(today, b.final_due_date);
    return daysOut >= 0 && daysOut <= CLOSURE_LEAD_DAYS;
  });

  if (candidates.length === 0) return 0;

  const loans = await loadLoanContext(candidates.map((c) => c.loan_id));
  let created = 0;

  for (const balance of candidates) {
    const loan = loans.get(balance.loan_id);
    if (!loan || loan.status !== "ACTIVE") continue;

    if (await alreadyNotified("loan_nearing_closure", { loan_id: balance.loan_id })) {
      continue;
    }

    const sent = await notify({
      userIds,
      type: "loan_nearing_closure",
      title: "Loan reaching its last EMI",
      body: `${describeLoan(loan)} has its final installment on ${balance.final_due_date}. Confirm closure and collect the NOC.`,
      linkPath: `/admin/loans/${balance.loan_id}`,
      metadata: { loan_id: balance.loan_id, checkpoint: "closure" },
    });
    if (sent) created += 1;
  }

  return created;
}

/** Keeps the notifications table from growing without bound. */
async function pruneOldNotifications() {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);

  const { error } = await supabase
    .from("notifications")
    .delete()
    .in("type", ["loan_emi_due", "loan_emi_overdue", "loan_nearing_closure"])
    .lt("created_at", cutoff.toISOString());

  if (error) console.error("Failed to prune old loan notifications:", error.message);
}

async function main() {
  const userIds = await resolveUserIdsForRoles(RECIPIENT_ROLES);
  if (userIds.length === 0) {
    console.warn("No admin/superadmin users found — skipping loan reminders.");
    return;
  }

  const emiCount = await checkEmiReminders(userIds);
  const closureCount = await checkLoansNearingClosure(userIds);

  await pruneOldNotifications();

  console.log(
    `Loan reminders: ${emiCount} EMI notification(s), ${closureCount} closure notification(s) sent to ${userIds.length} user(s).`,
  );
}

main().catch((err) => {
  console.error("check-loan-emis failed:", err);
  process.exit(1);
});
