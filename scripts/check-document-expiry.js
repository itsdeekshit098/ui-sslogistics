/* eslint-disable @typescript-eslint/no-require-imports */
// Daily job: warns admin/staff before a vehicle's insurance or FC (fitness
// certificate) lapses, and prunes old notifications so the table doesn't
// grow forever. Mirrors scripts/backup.js's structure (plain CommonJS,
// talks to Supabase directly via the service-role key) rather than
// depending on Next.js request context, since it runs as a standalone
// GitHub Actions job, not an API route.
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Checkpoints an admin/staff gets warned at, in days before expiry.
// 0 means "already expired". Checked oldest-first so a script that missed
// a run (or its very first run against existing data) still backfills
// every checkpoint the vehicle has genuinely crossed, not just the nearest one.
const THRESHOLDS = [30, 7, 1, 0];
const RETENTION_DAYS = 5;

const DOC_TYPES = [
  { key: "insurance", endField: "insurance_end_date", label: "Insurance" },
  { key: "fc", endField: "fc_end_date", label: "Fitness Certificate (FC)" },
];

let firebaseReady = false;
try {
  if (FIREBASE_SERVICE_ACCOUNT_JSON) {
    const { cert, initializeApp } = require("firebase-admin/app");
    initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)) });
    firebaseReady = true;
  } else {
    console.warn("FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications skipped, in-app only.");
  }
} catch (err) {
  console.error("Failed to initialize Firebase Admin SDK:", err.message);
}

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

async function notifyExpiry({ vehicle, docType, thresholdDays, userIds }) {
  const title =
    thresholdDays === 0
      ? `${docType.label} expired`
      : `${docType.label} expiring soon`;
  const body =
    thresholdDays === 0
      ? `${docType.label} for vehicle #${vehicle.vehicle_number || vehicle.id} has expired.`
      : `${docType.label} for vehicle #${vehicle.vehicle_number || vehicle.id} expires in ${thresholdDays} day${thresholdDays === 1 ? "" : "s"}.`;

  const rows = userIds.map((userId) => ({
    user_id: userId,
    type: "document_expiring",
    title,
    body,
    link_path: `/admin/vehicles?vehicle_id=${vehicle.id}`,
    metadata: {
      vehicle_id: vehicle.id,
      doc_type: docType.key,
      threshold_days: thresholdDays,
    },
  }));

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error("Failed to insert expiry notifications:", error.message);
    return;
  }

  await sendPushToUsers(userIds, {
    title,
    body,
    data: {
      type: "document_expiring",
      linkPath: `/admin/vehicles?vehicle_id=${vehicle.id}`,
      vehicle_id: vehicle.id,
      doc_type: docType.key,
    },
  });
}

async function alreadyNotified(vehicleId, docTypeKey, thresholdDays) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("type", "document_expiring")
    .eq("metadata->>vehicle_id", String(vehicleId))
    .eq("metadata->>doc_type", docTypeKey)
    .eq("metadata->>threshold_days", String(thresholdDays))
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to check existing expiry notifications:", error.message);
    return true; // fail safe — skip rather than risk duplicate spam
  }
  return !!data;
}

async function checkExpiringDocuments() {
  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("id, vehicle_number, insurance_end_date, fc_end_date");

  if (error) {
    console.error("Failed to load vehicles:", error.message);
    return;
  }

  const userIds = await resolveUserIdsForRoles(["admin", "staff"]);
  if (userIds.length === 0) {
    console.warn("No admin/staff users found — skipping expiry notifications.");
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let created = 0;

  for (const vehicle of vehicles || []) {
    for (const docType of DOC_TYPES) {
      const endDateStr = vehicle[docType.endField];
      if (!endDateStr) continue;

      const endDate = new Date(endDateStr);
      endDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((endDate - today) / (24 * 60 * 60 * 1000));

      for (const threshold of THRESHOLDS) {
        if (daysUntil > threshold) continue;

        const notified = await alreadyNotified(vehicle.id, docType.key, threshold);
        if (notified) continue;

        await notifyExpiry({ vehicle, docType, thresholdDays: threshold, userIds });
        created += 1;
      }
    }
  }

  console.log(`Expiry check complete: ${created} notification(s) created.`);
}

async function cleanupOldNotifications() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from("notifications")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (error) {
    console.error("Failed to clean up old notifications:", error.message);
    return;
  }

  console.log(`Retention cleanup complete: ${count ?? 0} notification(s) deleted.`);
}

async function main() {
  console.log("========= [1/2] Checking for expiring documents =========");
  await checkExpiringDocuments();

  console.log("\n========= [2/2] Cleaning up old notifications =========");
  await cleanupOldNotifications();
}

main().catch((err) => {
  console.error("check-document-expiry failed:", err);
  process.exit(1);
});
