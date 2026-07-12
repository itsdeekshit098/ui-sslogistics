/* eslint-disable @typescript-eslint/no-require-imports */
// Daily job: reminds admin/staff about upcoming confirmed trip bookings
// (advance phone bookings for external trips) 3 days, 1 day, and on the
// day before the trip starts, and prunes old notifications. Mirrors
// scripts/check-document-expiry.js's structure (plain CommonJS, talks to
// Supabase directly via the service-role key) since it runs as a
// standalone GitHub Actions job, not an API route.
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Days-before-start-date checkpoints a booking is reminded at.
// 0 means "trip starts today".
const THRESHOLDS = [3, 1, 0];
const RETENTION_DAYS = 5;

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

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

async function notifyBooking({ booking, thresholdDays, userIds }) {
  const title =
    thresholdDays === 0
      ? "Trip booking today"
      : `Trip booking in ${thresholdDays} day${thresholdDays === 1 ? "" : "s"}`;
  const body = `${booking.customer_name} — ${booking.vehicle_type} · ${booking.from_location} → ${booking.to_location} on ${formatDate(booking.start_date)}`;
  const linkPath = `/admin/trip-bookings?booking_id=${booking.id}`;

  const rows = userIds.map((userId) => ({
    user_id: userId,
    type: "trip_booking_reminder",
    title,
    body,
    link_path: linkPath,
    metadata: {
      booking_id: booking.id,
      days_until: thresholdDays,
      start_date: booking.start_date,
      customer_name: booking.customer_name,
      from_location: booking.from_location,
      to_location: booking.to_location,
      vehicle_type: booking.vehicle_type,
    },
  }));

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error("Failed to insert trip booking notifications:", error.message);
    return;
  }

  await sendPushToUsers(userIds, {
    title,
    body,
    data: {
      type: "trip_booking_reminder",
      linkPath,
      booking_id: booking.id,
      days_until: thresholdDays,
    },
  });
}

async function alreadyNotified(bookingId, thresholdDays) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("type", "trip_booking_reminder")
    .eq("metadata->>booking_id", String(bookingId))
    .eq("metadata->>days_until", String(thresholdDays))
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to check existing trip booking notifications:", error.message);
    return true; // fail safe — skip rather than risk duplicate spam
  }
  return !!data;
}

async function checkUpcomingBookings() {
  const { data: bookings, error } = await supabase
    .from("trip_bookings")
    .select("id, customer_name, from_location, to_location, start_date, vehicle_type")
    .eq("status", "confirmed");

  if (error) {
    console.error("Failed to load trip bookings:", error.message);
    return;
  }

  const userIds = await resolveUserIdsForRoles(["admin", "staff"]);
  if (userIds.length === 0) {
    console.warn("No admin/staff users found — skipping trip booking notifications.");
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let created = 0;

  for (const booking of bookings || []) {
    const startDate = new Date(booking.start_date);
    startDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((startDate - today) / (24 * 60 * 60 * 1000));

    if (!THRESHOLDS.includes(daysUntil)) continue;

    const notified = await alreadyNotified(booking.id, daysUntil);
    if (notified) continue;

    await notifyBooking({ booking, thresholdDays: daysUntil, userIds });
    created += 1;
  }

  console.log(`Trip booking check complete: ${created} notification(s) created.`);
}

async function cleanupOldNotifications() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from("notifications")
    .delete({ count: "exact" })
    .eq("type", "trip_booking_reminder")
    .lt("created_at", cutoff);

  if (error) {
    console.error("Failed to clean up old notifications:", error.message);
    return;
  }

  console.log(`Retention cleanup complete: ${count ?? 0} notification(s) deleted.`);
}

async function main() {
  console.log("========= [1/2] Checking upcoming trip bookings =========");
  await checkUpcomingBookings();

  console.log("\n========= [2/2] Cleaning up old notifications =========");
  await cleanupOldNotifications();
}

main().catch((err) => {
  console.error("check-trip-bookings failed:", err);
  process.exit(1);
});
