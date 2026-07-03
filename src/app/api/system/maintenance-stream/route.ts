import { getMaintenanceStatusUncached, type MaintenanceStatus } from "@/lib/systemSettings";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream that pushes maintenance-mode changes to
 * already-open clients (web + mobile) almost immediately, instead of them
 * only finding out on their next page load / API call.
 *
 * Deliberately not a Supabase Realtime subscription: this route just polls
 * the DB itself on a short interval and only writes to the client when the
 * value actually changes. That keeps the client side (browser EventSource /
 * mobile Dio stream) talking only to our own API — no Supabase URL or anon
 * key needs to be shipped to the mobile app — and avoids running a
 * websocket subscription inside a route handler, which is fragile on
 * serverless hosts.
 *
 * No auth required: this leaks nothing sensitive (just a boolean + a
 * message), and logged-out users on /login also need to know if the app is
 * under maintenance.
 */

const POLL_MS = 1_000;
const HEARTBEAT_MS = 20_000;

function encodeEvent(status: MaintenanceStatus): string {
  return `data: ${JSON.stringify(status)}\n\n`;
}

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      let last: MaintenanceStatus | null = null;

      const send = (status: MaintenanceStatus) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(status)));
        } catch {
          closed = true;
        }
      };

      // Send current state immediately so a freshly-opened connection
      // doesn't have to wait out the first poll interval.
      const initial = await getMaintenanceStatusUncached();
      last = initial;
      send(initial);

      pollTimer = setInterval(async () => {
        if (closed) return;
        const status = await getMaintenanceStatusUncached();
        if (
          !last ||
          status.maintenanceMode !== last.maintenanceMode ||
          status.message !== last.message
        ) {
          last = status;
          send(status);
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
