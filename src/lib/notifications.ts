import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export type NotificationRole = "admin" | "staff" | "driver";

interface NotifyRolesParams {
  roles: NotificationRole[];
  type: string;
  title: string;
  body: string;
  linkPath?: string;
  metadata?: Record<string, unknown>;
  /** Skip this user — typically the person who just performed the action,
   * so they don't get notified about their own change. */
  excludeUserId?: string;
}

interface CreateNotificationParams {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  linkPath?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Pages through all Supabase auth users to find those whose app_metadata.role
 * matches one of the given roles. Role isn't a queryable DB column — it lives
 * only in auth.users.app_metadata — so this can't be a simple `.eq()` filter.
 */
export async function resolveUserIdsForRoles(
  roles: NotificationRole[],
): Promise<string[]> {
  const userIds: string[] = [];
  const perPage = 200;
  let page = 1;

  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      logger.error("Failed to list users while resolving notification recipients", {
        message: error.message,
      });
      break;
    }

    const users = data.users || [];
    for (const u of users) {
      const role = u.app_metadata?.role;
      if (role && roles.includes(role as NotificationRole)) {
        userIds.push(u.id);
      }
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return userIds;
}

/**
 * Bulk-inserts one notification row per recipient. Fire-and-forget — never
 * throws into the caller, same style as logActivity. Returns the inserted
 * row id per user so callers (e.g. push) can tell each recipient's device
 * which notification row a tap corresponds to.
 */
export async function createNotification({
  userIds,
  type,
  title,
  body,
  linkPath,
  metadata = {},
}: CreateNotificationParams): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};

  try {
    const rows = userIds.map((userId) => ({
      user_id: userId,
      type,
      title,
      body,
      link_path: linkPath ?? null,
      metadata,
    }));

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert(rows)
      .select("id, user_id");
    if (error) {
      logger.error("Failed to insert notifications", { type, message: error.message });
      return {};
    }

    const idsByUser: Record<string, string> = {};
    for (const row of data || []) {
      idsByUser[row.user_id as string] = String(row.id);
    }
    return idsByUser;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Failed to create notifications", { type, error: errorMessage });
    return {};
  }
}

/** Resolves roles to user IDs, creates their notifications, and pushes to their devices. */
export async function notifyRoles({
  roles,
  type,
  title,
  body,
  linkPath,
  metadata,
  excludeUserId,
}: NotifyRolesParams): Promise<void> {
  let userIds = await resolveUserIdsForRoles(roles);
  if (excludeUserId) {
    userIds = userIds.filter((id) => id !== excludeUserId);
  }
  if (userIds.length === 0) return;

  const notificationIdsByUser = await createNotification({ userIds, type, title, body, linkPath, metadata });
  await sendPushToUsers(userIds, {
    title,
    body,
    data: { type, linkPath: linkPath ?? "", ...metadata },
    notificationIdsByUser,
  });
}

let firebaseInitialized = false;

function ensureFirebaseInitialized(): boolean {
  if (firebaseInitialized || getApps().length > 0) {
    firebaseInitialized = true;
    return true;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    logger.warn("FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications are disabled");
    return false;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    initializeApp({ credential: cert(serviceAccount) });
    firebaseInitialized = true;
    return true;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Failed to initialize Firebase Admin SDK", { error: errorMessage });
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends a push notification to every device registered for the given users.
 * Retries the FCM call itself inline (short backoff) if it fails outright —
 * a persisted retry-state + scheduled sweep was considered and dropped as
 * disproportionate to the risk (a single flaky outbound HTTP call), and the
 * in-app notification is already delivered independently of push outcome.
 */
export async function sendPushToUsers(
  userIds: string[],
  {
    title,
    body,
    data = {},
    notificationIdsByUser = {},
  }: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    /** Per-recipient notification row id, so a device can mark the exact
     * row read when the user taps the push. */
    notificationIdsByUser?: Record<string, string>;
  },
): Promise<void> {
  if (userIds.length === 0) return;
  if (!ensureFirebaseInitialized()) return;

  const { data: tokenRows, error } = await supabaseAdmin
    .from("device_push_tokens")
    .select("token, user_id")
    .in("user_id", userIds);

  if (error) {
    logger.error("Failed to load device push tokens", { message: error.message });
    return;
  }

  const rows = tokenRows || [];
  if (rows.length === 0) return;

  const baseData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    baseData[key] = String(value);
  }

  const tokens = rows.map((r) => r.token as string);
  const messages = rows.map((r) => {
    const notificationId = notificationIdsByUser[r.user_id as string];
    return {
      token: r.token as string,
      notification: { title, body },
      // Custom sound for background/terminated-app delivery, where the OS
      // renders the notification straight from this payload — foreground
      // delivery instead goes through push_service.dart's local-notification
      // sound config. channelId must match the Android channel created there.
      android: { notification: { sound: "notification", channelId: "vehicle_alerts" } },
      apns: { payload: { aps: { sound: "notification.caf" } } },
      data: notificationId ? { ...baseData, notificationId } : baseData,
    };
  });

  const attempts = [0, 1000, 3000]; // immediate, then 1s, then 3s backoff
  let lastError: unknown = null;

  for (let i = 0; i < attempts.length; i++) {
    if (attempts[i] > 0) await sleep(attempts[i]);

    try {
      const response = await getMessaging().sendEach(messages);

      const deadTokens: string[] = [];
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
        await supabaseAdmin.from("device_push_tokens").delete().in("token", deadTokens);
      }

      return;
    } catch (err: unknown) {
      lastError = err;
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  logger.error("Failed to send push notification after retries", { error: errorMessage });
}
