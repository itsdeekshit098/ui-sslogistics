import { supabaseAdmin } from "@/lib/supabase";
import { requireUserAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream that pushes new notifications to an
 * already-open client (web + mobile) almost immediately, instead of them
 * only finding out on their next poll / app resume.
 *
 * Deliberately not a Supabase Realtime subscription, matching the existing
 * /api/system/maintenance-stream precedent: this route polls the DB itself
 * on a short interval and only writes to the client rows newer than the
 * last one it already sent. That keeps the client side talking only to our
 * own API — no Supabase URL/anon key needs to reach the browser or mobile
 * app (see ui-sslogistics/CLAUDE.md) — and avoids running a websocket
 * subscription inside a route handler, which is fragile on serverless hosts.
 */

const POLL_MS = 2_000;
const HEARTBEAT_MS = 20_000;

interface NotificationRow {
  id: number;
  [key: string]: unknown;
}

export async function GET() {
  let authUser;
  try {
    authUser = await requireUserAuth();
  } catch (err: unknown) {
    return handleApiError(err);
  }

  const encoder = new TextEncoder();
  let closed = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (row: NotificationRow) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: notification\ndata: ${JSON.stringify(row)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Only ever push rows newer than whatever exists at connection time —
      // the client already hydrated its initial state via GET /api/notifications.
      const { data: latest } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("user_id", authUser.id)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      let lastId: number = latest?.id ?? 0;

      pollTimer = setInterval(async () => {
        if (closed) return;
        const { data, error } = await supabaseAdmin
          .from("notifications")
          .select("*")
          .eq("user_id", authUser.id)
          .gt("id", lastId)
          .order("id", { ascending: true });

        if (error) {
          logger.error("Notification stream poll failed", { error: error.message });
          return;
        }

        for (const row of (data as NotificationRow[]) ?? []) {
          send(row);
          lastId = row.id;
        }
      }, POLL_MS);

      // Comment lines (": ping") are ignored by SSE parsers but keep
      // intermediary proxies/load balancers from timing out an idle connection.
      heartbeatTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, HEARTBEAT_MS);
    },
    cancel() {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
